"""Post-delivery and terminal-failure side effects.

Both hooks must be best-effort: they run immediately after the SMTP call, so an
exception here would otherwise turn a delivered message into a failed one.
"""

import logging

logger = logging.getLogger('emails')


def after_send(log):
    """Run the post-delivery side effects. Best effort: never raises.

    Order matters — the customer's in-app notification is written first so a
    failure in the receipt bookkeeping below cannot suppress it.
    """
    _surface_notification(log)
    _sync_receipt(log, ok=True)


def after_fail(log):
    """Run the terminal-failure side effects. Best effort: never raises.

    Only terminal failures reach here — transient attempts stay in RETRYING so
    an SMTP outage produces one alert, not one per attempt.
    """
    _notify_staff_of_failure(log)
    _sync_receipt(log, ok=False)


def _surface_notification(log):
    """Surface the message in the customer's in-app notification centre.

    ``metadata['notification']`` carries the payload (including the
    ``event_key``) authored by the call site that queued the email. Reusing the
    *same* ``event_key`` the business layer already passed to its own
    ``notify_customer`` call is what stops the customer seeing one event twice:
    ``notify_customer`` dedupes on ``(user, event_key)``.
    """
    spec = (log.metadata or {}).get('notification')
    if not spec or not spec.get('event_key'):
        return
    if log.related_user_id is None:
        # Guest checkout: they received the email, but there is no account to
        # attach a CustomerNotification to.
        return

    from admin_ui.models import notify_customer

    notify_customer(
        log.related_user,
        spec.get('category') or 'system',
        (spec.get('title') or log.subject)[:200],
        spec.get('message') or '',
        link=spec.get('link') or '',
        event_key=spec['event_key'],
        event_type=log.email_type,
        severity=spec.get('severity') or 'info',
    )
    logger.info('customer notification %s created for email %s',
                spec['event_key'], log.pk)


def _sync_receipt(log, *, ok):
    """Mirror the delivery outcome onto ``Receipt`` (``email_sent_at`` and
    friends). The receipt page predates the central mailer, so the fields stay
    authoritative there while ``EmailLog`` owns the retry ladder.
    """
    receipt_id = (log.metadata or {}).get('receipt_id')
    if not receipt_id:
        return

    from django.utils import timezone

    from receipts.models import Receipt

    receipt = Receipt.objects.filter(pk=receipt_id).select_related('order').first()
    if receipt is None:
        logger.warning('receipt %s for email %s is gone', receipt_id, log.pk)
        return

    now = timezone.now()
    if ok:
        Receipt.objects.filter(pk=receipt.pk).update(
            email_sent_at=now,
            email_attempts=log.attempt_count,
            email_error='',
            updated_at=now,
        )
        _receipt_audit(
            'receipt_email_sent', receipt,
            description=f'Receipt {receipt.receipt_number} emailed to '
                        f'{log.recipient_email}.',
            metadata={'recipient': log.recipient_email, 'email_id': str(log.pk)},
        )
        logger.info('receipt %s marked emailed', receipt.receipt_number)
    else:
        Receipt.objects.filter(pk=receipt.pk).update(
            email_attempts=log.attempt_count,
            email_error=(log.last_error or '')[:300],
            updated_at=now,
        )
        _receipt_audit(
            'receipt_email_failed', receipt,
            description=f'Emailed receipt {receipt.receipt_number} failed.',
            result='failure',
            severity='medium',
            metadata={'recipient': log.recipient_email, 'email_id': str(log.pk),
                      'error': (log.last_error or '')[:300]},
        )
        logger.warning('receipt %s email marked failed: %s',
                       receipt.receipt_number, log.last_error)


def _receipt_audit(action, receipt, description, metadata, result='success',
                   severity='medium'):
    from audit.services import AuditLogService

    AuditLogService.log(
        action,
        object_type='receipt',
        object_id=receipt.pk,
        object_repr=receipt.receipt_number,
        category='payments',
        result=result,
        severity=severity,
        metadata=metadata,
        description=description,
    )


def _notify_staff_of_failure(log):
    """Tell the staff a message is permanently undeliverable.

    ``notify_staff`` dedupes on ``(recipient, event_key)``, so this is exactly
    one bell entry per failed message per admin.
    """
    from admin_ui.models import notify_staff

    message = f'{log.subject} \u2192 {log.recipient_email}'
    if log.last_error:
        message = f'{message}: {log.last_error[:200]}'

    notify_staff(
        category='system',
        title='Email delivery failed',
        message=message,
        link='/admin/dashboard/emails/?status=failed',
        event_key=f'email-failed:{log.pk}',
        event_type=log.email_type,
        severity='high',
        resource_type='email',
        resource_id=str(log.pk),
        metadata={
            'email_type': log.email_type,
            'attempt_count': log.attempt_count,
        },
    )
    logger.warning('staff notified about failed email %s', log.pk)
