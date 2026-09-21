from django.db.models.signals import post_save
from django.dispatch import receiver

from catalog.models import ProductVariant
from orders.models import Order

from .models import AdminNotification, notify_customer, notify_staff


@receiver(post_save, sender=Order)
def order_notification_signal(sender, instance, created, **kwargs):
    # Staff notifications are audit-linked and are emitted by the order
    # services (orders/services.py) that own each lifecycle transition, so the
    # admin bell always links back to the authoritative audit record. This
    # signal only keeps the customer-facing notifications.
    if created:
        if instance.user is not None:
            notify_customer(
                instance.user,
                'order',
                'Order placed',
                f'Your order {instance.order_number} has been placed and is being prepared.',
                link=f'/account/orders/{instance.order_number}',
                event_key=f'customer-order-created:{instance.pk}',
            )
        return

    if instance.status == Order.Status.CANCELLED:
        if instance.user is not None:
            notify_customer(
                instance.user,
                'order',
                'Order cancelled',
                f'Your order {instance.order_number} has been cancelled.',
                link=f'/account/orders/{instance.order_number}',
                event_key=f'customer-order-cancelled:{instance.pk}',
            )

    if instance.payment_status == Order.PaymentStatus.REFUNDED:
        if instance.user is not None:
            notify_customer(
                instance.user,
                'payment',
                'Refund processed',
                f'Your refund for order {instance.order_number} has been processed.',
                link=f'/account/orders/{instance.order_number}',
                event_key=f'customer-order-refunded:{instance.pk}',
            )


@receiver(post_save, sender=ProductVariant)
def low_stock_notification_signal(sender, instance, **kwargs):
    if instance.stock_quantity > 3:
        return
    product_name = getattr(instance.product, 'name', 'Product')
    notify_staff(
        AdminNotification.Category.INVENTORY,
        'Low stock alert',
        f'Low stock: {product_name} ({instance.sku}) is down to {instance.stock_quantity}.',
        link=f'/admin/dashboard/inventory/adjust/?variant={instance.pk}',
        event_key=f'low-stock:{instance.pk}',
    )
