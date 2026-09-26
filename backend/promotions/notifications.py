"""Promotion notifications + email hooks.

Everything funnels through the existing infrastructure:
- in-app customer notes via ``admin_ui.models.notify_customer``,
- staff alerts via ``AdminNotificationService.notify_for_audit``,
- outbound mail via ``emails.services.queue_email`` (which honours the
  ``EMAIL_ENABLED`` kill switch and per-message idempotency keys).

Callers are responsible for consent: promotional mail must only be queued
for recipients who opted in (pass ``consented=True`` explicitly).
"""
import logging

from admin_ui.models import notify_customer
from emails.services import queue_email

logger = logging.getLogger('promotions.notifications')


def announce_promotion(promotion, recipients, consented=False):
    """Queue a promotion announcement email per recipient.

    ``recipients`` is an iterable of ``(email, name, user_or_None)``.
    Returns the number of queued messages. Never raises.
    """
    if not consented:
        logger.info('Promotion announcement for %s skipped: no consent flag.',
                    getattr(promotion, 'pk', '?'))
        return 0
    queued = 0
    code = getattr(promotion, 'coupon_code', '') or ''
    headline = f'{promotion.name} is live at MODEZA Boutique.'
    body = (
        f'{headline}\n\n'
        f'{promotion.description or ""}\n'
        + (f'Use code {code} at checkout.\n' if code and not promotion.is_automatic else
           'The offer applies automatically at checkout.\n')
    )
    for email, name, user in recipients:
        if not (email or '').strip():
            continue
        try:
            queue_email(
                email_type='promotion_announcement',
                subject=f'MODEZA: {promotion.name}',
                body_text=body,
                recipient_email=email.strip(),
                recipient_name=name or '',
                related_user=user,
                idempotency_key=f'promotion-announcement:{promotion.pk}:{email.strip().lower()}',
                notification={
                    'category': 'promotion',
                    'title': promotion.name,
                    'message': headline,
                    'link': '/shop',
                    'event_key': f'promotion-announced:{promotion.pk}',
                },
            )
            queued += 1
        except Exception:
            logger.exception('Failed to queue promotion announcement for %s', email)
    return queued


def notify_coupon_issued(user, code, promotion_name=''):
    """In-app note when a personal coupon is issued. Never raises."""
    try:
        notify_customer(
            user, 'promotion', 'A coupon was issued to you',
            f'Use code {code} at checkout'
            + (f' ({promotion_name}).' if promotion_name else '.'),
            link='/cart', event_key=f'coupon-issued:{user.pk}:{code}',
        )
    except Exception:
        logger.exception('Failed to notify coupon issuance for user %s',
                         getattr(user, 'pk', '?'))
