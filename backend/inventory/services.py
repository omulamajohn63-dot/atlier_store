from django.db import transaction
from datetime import timedelta
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from admin_ui.models import notify_staff
from audit.services import AuditLogService
from catalog.models import ProductVariant

from .models import InventoryTransaction, StockReservation


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
    return InventoryTransaction.objects.create(
        variant=variant,
        quantity_delta=delta,
        previous_quantity=previous,
        new_quantity=new_quantity,
        reason=reason,
        actor=actor,
    )


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
