"""Promotion discovery + coupon validation (coupon codes never disclosed).

Follows the same non-disclosure rule as ``promotions.views``: automatic
promotions are described fully; coupon-based ones expose only the badge and
``AVAILABLE_AT_CHECKOUT``.
"""
from django.db.models import Q

from promotions.models import Promotion, normalize_coupon_code
from promotions.services import candidate_promotions


def _badge(promo):
    if promo.promotion_type == 'percentage':
        return f'{promo.discount_percent:g}% OFF'
    if promo.promotion_type == 'fixed':
        return f'KES {(promo.discount_amount_minor or 0) / 100:,.0f} OFF'
    if promo.promotion_type == 'free_shipping':
        return 'FREE DELIVERY'
    if promo.promotion_type == 'buy_x_get_y':
        return 'BUY X GET Y'
    if promo.promotion_type == 'buy_x_get_pct':
        return f'{promo.reward_discount_percent:g}% OFF'
    return 'OFFER'


def _serialize(promo, automatic_only=True):
    return {
        'name': promo.name,
        'description': (promo.description or '').strip()[:300],
        'badge': _badge(promo),
        'automatic': bool(promo.is_automatic),
        'code': '' if promo.is_automatic else 'AVAILABLE_AT_CHECKOUT',
        'startsAt': promo.starts_at.isoformat() if promo.starts_at else '',
        'endsAt': promo.ends_at.isoformat() if promo.ends_at else '',
        'minimumOrderKes': round((promo.minimum_order_value_minor or 0) / 100, 2),
    }


def get_active_promotions(*, context=None):
    from django.utils import timezone

    automatics = [_serialize(p) for p in candidate_promotions()]
    now = timezone.now()
    coupon_qs = Promotion.objects.filter(
        status=Promotion.Status.ACTIVE, is_automatic=False,
        coupon_code_normalized__gt='',
    ).filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now)).filter(
        Q(ends_at__isnull=True) | Q(ends_at__gte=now))
    coupon_offers = [
        {'name': p.name, 'badge': _badge(p), 'code': 'AVAILABLE_AT_CHECKOUT'}
        for p in coupon_qs.order_by('-priority')[:10]
    ]
    return {
        'promotions': automatics,
        'couponOffers': coupon_offers,
        'note': 'Coupon codes are only shared by the store and are applied '
                'at checkout. Never invent a code.',
    }


def validate_promotion_code(*, context=None, code=''):
    normalized = normalize_coupon_code(code or '')
    if not normalized:
        return {'valid': False, 'reason': 'empty_code',
                'message': 'That code looks empty.'}

    matched = [p for p in candidate_promotions(coupon_normalized=normalized)
               if p.coupon_code_normalized == normalized]
    promo = matched[0] if matched else None
    if promo is None:
        return {'valid': False, 'reason': 'unknown_code',
                'message': 'That code is not recognised.'}

    from django.utils import timezone
    now = timezone.now()
    if promo.status != Promotion.Status.ACTIVE:
        return {'valid': False, 'reason': 'not_active',
                'message': 'That code is not currently running.'}
    if promo.starts_at and promo.starts_at > now:
        return {'valid': False, 'reason': 'not_started',
                'message': 'That code is not active yet.'}
    if promo.ends_at and promo.ends_at < now:
        return {'valid': False, 'reason': 'expired',
                'message': 'That code has expired.'}

    return {
        'valid': True,
        'name': promo.name,
        'badge': _badge(promo),
        'message': 'That code is valid. It is applied to your cart at checkout.',
        'code': 'AVAILABLE_AT_CHECKOUT',
        'minimumOrderKes': round((promo.minimum_order_value_minor or 0) / 100, 2),
    }
