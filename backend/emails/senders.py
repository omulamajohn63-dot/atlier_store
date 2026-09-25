"""Rendering: turn an :class:`~emails.models.EmailLog` into a sendable message.

``EmailMultiAlternatives`` is used for every type. It inherits ``send()`` from
``EmailMessage`` rather than redefining it, so a test that patches
``EmailMessage.send`` — the existing inventory back-in-stock tests do exactly
this — still intercepts messages built here.
"""

import logging
import mimetypes

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger('emails')


def _base_context(log):
    return {
        'subject': log.subject,
        'body_text': log.body_text,
        'recipient_name': log.recipient_name,
        'store_name': getattr(settings, 'STORE_NAME', 'MODEZA Boutique'),
        'store_email': getattr(settings, 'STORE_EMAIL', ''),
        'store_phone': getattr(settings, 'STORE_PHONE', ''),
        'store_website': getattr(settings, 'STORE_WEBSITE', ''),
        'store_address': getattr(settings, 'STORE_ADDRESS', ''),
        'email_type': log.email_type,
    }


def _attach_files(message, log):
    for item in (log.attachments or []):
        if isinstance(item, dict):
            key = item.get('key') or ''
            name = item.get('name') or key.rsplit('/', 1)[-1]
            mimetype = item.get('mimetype')
        else:
            key, name, mimetype = str(item), str(item).rsplit('/', 1)[-1], None
        if not key:
            continue
        try:
            with default_storage.open(key, 'rb') as handle:
                payload = handle.read()
        except Exception:  # noqa: BLE001 - a missing attachment is not fatal
            logger.exception('could not attach %s to email %s', key, log.pk)
            continue
        if not mimetype:
            mimetype = mimetypes.guess_type(name)[0] or 'application/octet-stream'
        message.attach(name, payload, mimetype)


def build_message(log):
    """Return a fully rendered, ready-to-send ``EmailMultiAlternatives``."""
    context = _base_context(log)
    html = render_to_string('emails/base.html', context)
    text = render_to_string('emails/base.txt', context)

    message = EmailMultiAlternatives(
        subject=log.subject,
        body=text,
        from_email=log.sender_email or settings.DEFAULT_FROM_EMAIL,
        to=[log.recipient_email],
    )
    message.attach_alternative(html, 'text/html')
    _attach_files(message, log)
    return message
