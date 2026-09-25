"""Celery entry point for email delivery.

All decision logic lives in :mod:`emails.services` so the inline (no-worker)
path and the queued path execute byte-for-byte the same code — this module only
adds scheduling.
"""

import logging

from celery import shared_task
from django.utils import timezone

from .models import EmailLog

logger = logging.getLogger('emails')


@shared_task(queue='email', time_limit=600, soft_time_limit=540, acks_late=True)
def send_email_log(log_id):
    """Deliver one :class:`EmailLog` and schedule the next attempt if needed.

    Retry state lives on the row (``attempt_count`` / ``next_retry_at``), not in
    Celery: a broker restart may drop the message, but the log still records how
    far the ladder has got, and ``requeue_stuck_emails`` can re-derive work from
    it. The follow-up is therefore dispatched as a *fresh* message rather than
    via ``task.retry()``.
    """
    from .services import deliver_email_log

    log = deliver_email_log(log_id)
    if log is None:
        return {'status': 'missing'}

    if log.status == EmailLog.Status.RETRYING and log.next_retry_at:
        delay = max(1, int((log.next_retry_at - timezone.now()).total_seconds()))
        send_email_log.apply_async(args=[str(log_id)], countdown=delay)

    return {'status': log.status, 'attempt': log.attempt_count}
