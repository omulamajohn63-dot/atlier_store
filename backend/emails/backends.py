"""HTTPS delivery transport: POST the rendered message to the Resend API.

Render's free plan blocks outbound SMTP (ports 25/465/587), so a socket to
``smtp.gmail.com`` fails with ``OSError [Errno 101] Network is unreachable``.
Port 443 is not blocked, which is why mail leaves through an HTTPS API
instead.

The contract with the rest of the mailer is Django's own:
``send_messages(email_messages)`` returns how many were accepted, and every
field is read through ``django.core.mail``'s public surface — so nothing
above this layer knows or cares which transport is configured.
"""

import base64
import logging

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger('emails')

RESEND_ENDPOINT = 'https://api.resend.com/emails'

#: HTTP statuses meaning "this exact request can never succeed" — a bad or
#: missing API key, an unverified sending domain, a malformed payload.
#: Retrying them only burns the ladder, so they fail permanently and ring the
#: staff bell instead.
PERMANENT_STATUSES = frozenset({400, 401, 403, 422})

#: Resend truncates/rejects oversized attachments at 40 MB per email.
MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024


class EmailAPIError(Exception):
    """A rejected API call, carrying its own retry verdict.

    ``permanent`` is read by :func:`emails.services.classify_failure`, which
    checks it before the legacy ``smtp_code`` heuristic — so 401 fails fast
    while 429/5xx wait out the ladder.
    """

    def __init__(self, message, *, status_code=None, permanent=False, body=''):
        super().__init__(message)
        self.status_code = status_code
        self.permanent = permanent
        self.response_body = (body or '')[:500]

    def __str__(self):
        base = super().__str__()
        if self.status_code is None:
            return base
        detail = f'HTTP {self.status_code}'
        if self.response_body:
            detail += f': {self.response_body}'
        return f'{base} ({detail})'


def _html_part(message):
    # Only EmailMultiAlternatives carries an alternatives list; a plain
    # EmailMessage must not crash the transport.
    for content, mimetype in getattr(message, 'alternatives', None) or []:
        if mimetype == 'text/html':
            return content
    return None


def _attachment_payload(filename, content, mimetype):
    if isinstance(content, str):
        content = content.encode('utf-8')
    payload = bytes(content)
    if len(payload) > MAX_ATTACHMENT_BYTES:
        raise EmailAPIError(
            f'attachment {filename!r} exceeds {MAX_ATTACHMENT_BYTES} bytes',
            permanent=True,
        )
    return {
        'filename': str(filename or 'attachment'),
        'content': base64.b64encode(payload).decode('ascii'),
        'content_type': mimetype or 'application/octet-stream',
    }


def build_payload(message):
    """Translate a ``django.core.mail`` message into Resend's JSON body."""
    payload = {
        'from': message.from_email,
        'to': list(message.to),
        'subject': message.subject or '',
        'text': message.body or '',
    }
    if message.cc:
        payload['cc'] = list(message.cc)
    if message.bcc:
        payload['bcc'] = list(message.bcc)
    if message.reply_to:
        payload['reply_to'] = list(message.reply_to)

    html = _html_part(message)
    if html:
        payload['html'] = html

    attachments = []
    for entry in message.attachments:
        # Django stores (filename, content, mimetype) tuples; a bare
        # ``MIMEBase`` would need re-serialising and nothing in this codebase
        # attaches one, so it is skipped rather than guessed at.
        if not isinstance(entry, (tuple, list)) or len(entry) < 2:
            logger.warning('skipping unsupported attachment %r', entry)
            continue
        filename, content = entry[0], entry[1]
        mimetype = entry[2] if len(entry) > 2 else None
        attachments.append(_attachment_payload(filename, content, mimetype))
    if attachments:
        payload['attachments'] = attachments

    return payload


class ResendEmailBackend(BaseEmailBackend):
    """Send through the Resend HTTP API over HTTPS (port 443)."""

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        api_key = (getattr(settings, 'RESEND_API_KEY', '') or '').strip()
        if not api_key:
            raise EmailAPIError('RESEND_API_KEY is not configured', permanent=True)

        timeout = getattr(settings, 'EMAIL_TIMEOUT', None) or 10

        sent = 0
        for message in email_messages:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            }
            # Resend deduplicates on this for 24h — a second safety net
            # behind the EmailLog idempotency key, so a double sweep that
            # races past our atomic claim still cannot double-deliver.
            idempotency_key = (message.extra_headers or {}).get('Idempotency-Key')
            if idempotency_key:
                headers['Idempotency-Key'] = str(idempotency_key)[:256]

            try:
                response = requests.post(
                    RESEND_ENDPOINT,
                    json=build_payload(message),
                    headers=headers,
                    timeout=timeout,
                )
            except requests.RequestException as exc:
                # DNS/TCP/TLS/timeout — always transient.
                raise EmailAPIError(
                    f'Resend request failed: {exc}', permanent=False
                ) from exc

            if response.status_code >= 400:
                try:
                    body = response.json()
                except ValueError:
                    body = response.text
                detail = body.get('message') if isinstance(body, dict) else str(body)
                raise EmailAPIError(
                    f'Resend rejected the message: {detail or "no detail"}',
                    status_code=response.status_code,
                    permanent=response.status_code in PERMANENT_STATUSES,
                    body=str(detail or ''),
                )

            sent += 1
            logger.info('resend accepted message to %s', ', '.join(message.to))

        return sent
