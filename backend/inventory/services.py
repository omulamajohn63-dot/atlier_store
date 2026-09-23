from django.core.mail import EmailMessage
from django.db import transaction
from datetime import timedelta
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from admin_ui.models import notify_staff
from audit.services import AuditLogService
from catalog.models import ProductVariant

from .models import BackInStockRequest, InventoryTransaction, StockReservation


def _audit_variant(action, variant, metadata=None, result='success'):
    AuditLogService.log(
        action,
        object_type='product_variant',
        object_id=variant.pk,
        object_repr=variant.sku or str(variant.pk),
        category='inventory',
        result=result,
        metadata=metadata,
        description=f'{action}: {variant.sku}',
    )


def reserve_variant(order, variant, quantity):
    if quantity < 1:
        raise ValidationError({'quantity': 'Quantity must be at least 1.'})
    locked_variant = ProductVariant.objects.select_for_update().get(pk=variant.pk)
    if locked_variant.stock_quantity < quantity:
        raise ValidationError(
            {'stock': f'Only {locked_variant.stock_quantity} items are available.'})
    previous = locked_variant.stock_quantity
    locked_variant.stock_quantity -= quantity
    locked_variant.save(update_fields=['stock_quantity'])
    if locked_variant.stock_quantity <= 3:
        notify_staff(
            'inventory',
            'Low stock alert',
            f'Low stock: {locked_variant.product.name} ({locked_variant.sku}) is down to {locked_variant.stock_quantity}.',
            link=f'/admin/dashboard/inventory/adjust/?variant={locked_variant.pk}',
            event_key=f'low-stock:{locked_variant.pk}',
        )
    reservation = StockReservation.objects.create(
        order=order,
        variant=locked_variant,
        quantity=quantity,
        expires_at=timezone.now() + timedelta(minutes=30),
    )
    _audit_variant(
        'status_change', locked_variant,
        metadata={'delta': -quantity, 'previous_quantity': previous,
                  'new_quantity': locked_variant.stock_quantity,
                  'reason': 'order_reservation'},
    )
    InventoryTransaction.objects.create(
        variant=locked_variant,
        quantity_delta=-quantity,
        previous_quantity=previous,
        new_quantity=locked_variant.stock_quantity,
        reason='order_reservation',
        order=order,
    )
    return reservation


@transaction.atomic
def release_reservation(reservation):
    reservation = StockReservation.objects.select_for_update(
    ).select_related('variant').get(pk=reservation.pk)
    if reservation.status != StockReservation.Status.ACTIVE:
        return False
    variant = ProductVariant.objects.select_for_update().get(pk=reservation.variant_id)
    previous = variant.stock_quantity
    variant.stock_quantity += reservation.quantity
    variant.save(update_fields=['stock_quantity'])
    transaction.on_commit(
        lambda: _maybe_notify_restock(variant, previous, variant.stock_quantity))
    reservation.status = StockReservation.Status.RELEASED
    reservation.released_at = timezone.now()
    reservation.save(update_fields=['status', 'released_at'])
    _audit_variant(
        'status_change', variant,
        metadata={'delta': reservation.quantity, 'previous_quantity': previous,
                  'new_quantity': variant.stock_quantity,
                  'reason': 'reservation_release'},
    )
    InventoryTransaction.objects.create(
        variant=variant,
        quantity_delta=reservation.quantity,
        previous_quantity=previous,
        new_quantity=variant.stock_quantity,
        reason='reservation_release',
        order=reservation.order,
    )
    return True


@transaction.atomic
def adjust_stock(variant_id, delta, reason, actor=None):
    variant = ProductVariant.objects.select_for_update().get(pk=variant_id)
    new_quantity = variant.stock_quantity + delta
    if new_quantity < 0:
        raise ValidationError({'stock': 'Stock cannot become negative.'})
    previous = variant.stock_quantity
    variant.stock_quantity = new_quantity
    variant.save(update_fields=['stock_quantity'])
    _audit_variant(
        'update', variant,
        metadata={'delta': delta, 'previous_quantity': previous,
                  'new_quantity': new_quantity, 'reason': reason},
    )
    if variant.stock_quantity <= 3:
        notify_staff(
            'inventory',
            'Low stock alert',
            f'Low stock: {variant.product.name} ({variant.sku}) is down to {variant.stock_quantity}.',
            link=f'/admin/dashboard/inventory/adjust/?variant={variant.pk}',
            event_key=f'low-stock:{variant.pk}',
        )
    transaction.on_commit(
        lambda: _maybe_notify_restock(variant, previous, new_quantity))
    return InventoryTransaction.objects.create(
        variant=variant,
        quantity_delta=delta,
        previous_quantity=previous,
        new_quantity=new_quantity,
        reason=reason,
        actor=actor,
    )


def _maybe_notify_restock(variant, previous, new_quantity):
    """Notify back-in-stock subscribers when a variant returns to stock."""
    if previous > 0 or new_quantity <= 0:
        return
    try:
        notify_back_in_stock(variant, new_quantity)
    except Exception:  # noqa: BLE001 - restock must never break
        __import__('logging').getLogger('modeza.inventory').exception(
            'Back-in-stock notification failed for %s', variant.sku)


@transaction.atomic
def subscribe_to_stock_alert(variant_id, email):
    """Register a customer's back-in-stock request for a variant.

    Records real audit entries (no invented state) and respects a single
    pending (or already-notified) request per (variant, email).
    """
    email = (email or '').strip().lower()
    from django.core.validators import validate_email
    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_email(email)
    except DjangoValidationError:
        raise ValidationError({'email': 'Enter a valid email address.'})

    variant = ProductVariant.objects.filter(pk=variant_id).first()
    if variant is None:
        raise ValidationError({'variant': 'Product variant was not found.'})

    existing, created = BackInStockRequest.objects.get_or_create(
        variant=variant,
        email=email,
        defaults={'status': BackInStockRequest.Status.PENDING},
    )
    if created:
        AuditLogService.log(
            'back_in_stock_subscribed',
            object_type='product_variant',
            object_id=variant.pk,
            object_repr=variant.sku,
            category='catalog',
            metadata={'email': email, 'variant_id': str(variant.id)},
            description=f'Back-in-stock request for {variant.sku} from {email}.',
        )
    return existing, created


@transaction.atomic
def notify_back_in_stock(variant, quantity):
    """Notify pending back-in-stock requests once a variant is restocked.

    Only fires on a real stock transition into availability and only once per
    (variant, email). Email delivery must never break the restock.
    """
    pending = list(BackInStockRequest.objects.filter(
        variant=variant,
        status=BackInStockRequest.Status.PENDING,
    ))
    if not pending:
        return []

    notified = []
    for request in pending:
        request.status = BackInStockRequest.Status.NOTIFIED
        request.notified_at = timezone.now()
        request.save(update_fields=['status', 'notified_at', ])
        AuditLogService.log(
            'back_in_stock_notified',
            object_type='product_variant',
            object_id=variant.pk,
            object_repr=variant.sku,
            category='catalog',
            result='success',
            metadata={'email': request.email,
                      'variant_id': str(variant.id), 'quantity': quantity},
            description=f'Back-in-stock email sent to {request.email} for {variant.sku}.',
        )
        notified.append(request.email)
        _send_back_in_stock_email(request, variant)

    return notified


def _send_back_in_stock_email(request, variant):
    """Best-effort email delivery for a back-in-stock notification."""
    from django.conf import settings
    subject = f'{getattr(settings, "STORE_NAME", "Modeza Boutique")} — back in stock'
    body = (
        f'Hello,\n\n'
        f'Good news: {variant.product.name}'
        f'{" (" + variant.size + ")" if variant.size else ""} is back in stock.\n\n'
        f'Shop it now on '
        f'{getattr(settings, "FRONTEND_ORIGIN", "http://localhost:3000")}'
        f'/products/{variant.product.slug}.\n\n'
        f'{getattr(settings, "STORE_NAME", "Modeza Boutique")}\n'
        f'{getattr(settings, "STORE_ADDRESS", "")}'
    )
    try:
        EmailMessage(
            subject, body, settings.DEFAULT_FROM_EMAIL, [request.email]).send(
            fail_silently=True)
    except Exception:  # noqa: BLE001 - delivery must never break the restock
        logger = __import__('logging').getLogger('modeza.inventory')
        logger.warning('Back-in-stock email failed for %s', request.email)


@transaction.atomic
def expire_reservations():
    now = timezone.now()
    reservations = StockReservation.objects.select_for_update().filter(
        status=StockReservation.Status.ACTIVE,
        expires_at__isnull=False,
        expires_at__lte=now,
    )
    expired = 0
    for reservation in reservations:
        if release_reservation(reservation):
            reservation.status = StockReservation.Status.EXPIRED
            reservation.save(update_fields=['status'])
            expired += 1
    return expired
