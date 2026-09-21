import uuid

from django.db import transaction
from rest_framework.exceptions import ValidationError

from admin_ui.models import notify_customer
from admin_ui.services import AdminNotificationService
from audit.services import AuditLogService
from cart.models import Cart
from inventory.services import release_reservation, reserve_variant

from .models import Order, OrderItem

FREE_SHIPPING_THRESHOLD_MINOR = 15000
EXPRESS_SHIPPING_COST_MINOR = 1500
VAT_RATE = 0.16


def _audit_order(action, order, result='success', metadata=None, status_code=None):
    return AuditLogService.log(
        action,
        object_type='order',
        object_id=order.pk,
        object_repr=order.order_number,
        category='orders',
        result=result,
        metadata=metadata,
        status_code=status_code,
        description=f'{action}: order {order.order_number}',
    )


@transaction.atomic
def receive_order(order):
    if order.status == Order.Status.RECEIVED:
        return order
    if order.status != Order.Status.DELIVERED:
        raise ValidationError(
            {'status': 'Only delivered orders can be marked as received.'})

    previous_status = order.status
    order.status = Order.Status.RECEIVED
    order.save(update_fields=['status', 'updated_at'])
    _audit_order(
        'order_received', order,
        metadata={'from': previous_status, 'to': Order.Status.RECEIVED,
                  'reason': 'received'},
    )

    if order.user is not None:
        notify_customer(
            order.user,
            'order',
            'Order received',
            f'Your order {order.order_number} has been marked as received.',
            link=f'/account/orders/{order.order_number}',
            event_key=f'customer-order-received:{order.pk}',
        )

    return order


@transaction.atomic
def mark_received_paid(order):
    # For cash/pay-on-delivery orders the payment is collected at handover, so
    # confirming receipt on a delivered order settles the outstanding balance.
    if order.status == Order.Status.RECEIVED:
        return order
    is_delivery_payment = order.payment_method in {
        'cash_on_delivery',
        'pay_on_delivery',
    }
    # Delivery-payment orders can be settled and marked received at handover
    # even while still pending (the shop may not update the status first).
    receivable_statuses = (
        (Order.Status.PENDING, Order.Status.CONFIRMED, Order.Status.DELIVERED)
        if is_delivery_payment
        else (Order.Status.CONFIRMED, Order.Status.DELIVERED)
    )
    if order.status not in receivable_statuses:
        raise ValidationError(
            {'status': 'Only confirmed or delivered orders can be marked as received and paid.'})

    previous_status = order.status
    previous_payment = order.payment_status
    order.status = Order.Status.RECEIVED
    if is_delivery_payment and order.payment_status != Order.PaymentStatus.PAID:
        order.payment_status = Order.PaymentStatus.PAID
    order.save(update_fields=['status', 'payment_status', 'updated_at'])
    audit_log = _audit_order(
        'order_received', order,
        metadata={'from': previous_status, 'to': Order.Status.RECEIVED,
                  'payment_from': previous_payment,
                  'payment_to': order.payment_status,
                  'reason': 'received_and_paid'},
    )
    AdminNotificationService.notify_for_audit(
        audit_log,
        event_key=f'order-received:{order.pk}',
        message=f'Order {order.order_number} has been marked as received.',
        link=f'/admin/dashboard/orders/{order.pk}/',
    )

    if order.user is not None:
        notify_customer(
            order.user,
            'order',
            'Order received and paid',
            f'Your order {order.order_number} has been marked as received and settled.',
            link=f'/account/orders/{order.order_number}',
            event_key=f'customer-order-received-paid:{order.pk}',
        )

    return order


def shipping_cost_minor(subtotal_minor, shipping_method):
    # Kenya storefront rule: standard shipping is 20% of the cart subtotal and is
    # free once the subtotal reaches the KSh 15,000 threshold. Express is a flat
    # KSh 1,500 premium regardless of subtotal.
    if subtotal_minor <= 0:
        return 0
    if shipping_method == 'express':
        return EXPRESS_SHIPPING_COST_MINOR
    if subtotal_minor >= FREE_SHIPPING_THRESHOLD_MINOR:
        return 0
    return int(round(subtotal_minor * 0.20))


def tax_cost_minor(subtotal_minor):
    # Kenya standard VAT (16%) applied to the taxable subtotal.
    if subtotal_minor <= 0:
        return 0
    return int(round(subtotal_minor * VAT_RATE))


@transaction.atomic
def create_order(cart_key, payload, user=None):
    try:
        cart = Cart.objects.select_for_update().prefetch_related(
            'items__variant__product').get(cart_key=cart_key)
    except Cart.DoesNotExist as exc:
        raise ValidationError({'cart': 'Cart was not found.'}) from exc
    items = list(cart.items.all())
    if not items:
        raise ValidationError(
            {'cart': 'Cannot create an order from an empty cart.'})

    AuditLogService.log(
        'checkout_started',
        category='orders',
        result='success',
        object_type='cart',
        object_id=cart.cart_key,
        metadata={'item_count': len(items), 'payment_method': payload.get(
            'paymentMethod', 'mpesa')},
        description='Checkout started from cart.',
    )

    order_items = []
    subtotal_minor = 0
    for cart_item in items:
        variant = cart_item.variant
        price_minor = variant.price_minor if variant.price_minor is not None else variant.product.price_minor
        line_total_minor = price_minor * cart_item.quantity
        subtotal_minor += line_total_minor
        order_items.append((cart_item, variant, price_minor, line_total_minor))

    shipping_method = payload.get('shippingMethod', 'standard')
    payment_method = payload.get('paymentMethod', 'mpesa')
    shipping_minor = shipping_cost_minor(subtotal_minor, shipping_method)
    tax_minor = tax_cost_minor(subtotal_minor)
    order = Order.objects.create(
        order_number=f'AT-{uuid.uuid4().hex[:12].upper()}',
        cart=cart,
        user=user,
        customer=payload['customer'],
        notes=payload.get('notes', ''),
        subtotal_minor=subtotal_minor,
        shipping_cost_minor=shipping_minor,
        tax_minor=tax_minor,
        total_minor=subtotal_minor + shipping_minor + tax_minor,
        shipping_method=shipping_method,
        payment_method=payment_method,
    )
    for cart_item, variant, price_minor, line_total_minor in order_items:
        reserve_variant(order, variant, cart_item.quantity)
        OrderItem.objects.create(
            order=order,
            product=variant.product,
            variant=variant,
            product_name=variant.product.name,
            variant_sku=variant.sku,
            variant_size=variant.size,
            variant_color=variant.color,
            image_url=(variant.product.images or [''])[0],
            unit_price_minor=price_minor,
            quantity=cart_item.quantity,
            line_total_minor=line_total_minor,
        )
    cart.items.all().delete()
    audit_log = _audit_order(
        'order_created', order,
        status_code=201,
        metadata={'total_minor': order.total_minor,
                  'payment_method': order.payment_method},
    )
    AdminNotificationService.notify_for_audit(
        audit_log,
        event_key=f'order-created:{order.pk}',
        message=f'New order {order.order_number} was placed '
                f'({order.customer.get("fullName") or "a customer"}).',
        link=f'/admin/dashboard/orders/{order.pk}/',
    )
    if user is not None:
        notify_customer(
            user,
            'order',
            'Order placed',
            f'Your order {order.order_number} has been placed and is being prepared.',
            link=f'/account/orders/{order.order_number}',
            event_key=f'customer-order-created:{order.pk}',
        )
    return order


@transaction.atomic
def approve_order(order):
    is_delivery_payment = order.payment_method in {
        'cash_on_delivery',
        'pay_on_delivery',
    }
    if order.payment_status != Order.PaymentStatus.PAID and not is_delivery_payment:
        raise ValidationError(
            {'payment_status': 'Only paid orders can be approved.'})
    if order.status == Order.Status.CONFIRMED:
        return order
    previous_status = order.status
    if order.payment_status != Order.PaymentStatus.PAID and is_delivery_payment:
        order.payment_status = Order.PaymentStatus.PAID
    order.status = Order.Status.CONFIRMED
    order.save(update_fields=['status', 'payment_status', 'updated_at'])
    audit_log = _audit_order(
        'order_confirmed', order,
        metadata={'from': previous_status, 'to': Order.Status.CONFIRMED,
                  'reason': 'approved'},
    )
    AdminNotificationService.notify_for_audit(
        audit_log,
        event_key=f'order-confirmed:{order.pk}',
        message=f'Order {order.order_number} has been confirmed.',
        link=f'/admin/dashboard/orders/{order.pk}/',
    )
    if order.user is not None:
        notify_customer(
            order.user,
            'order',
            'Order confirmed',
            f'Your order {order.order_number} has been confirmed and is now being prepared.',
            link=f'/account/orders/{order.order_number}',
            event_key=f'customer-order-confirmed:{order.pk}',
        )
    return order


@transaction.atomic
def refund_order(order):
    if order.payment_status == Order.PaymentStatus.REFUNDED:
        return order
    order.payment_status = Order.PaymentStatus.REFUNDED
    order.save(update_fields=['payment_status', 'updated_at'])
    audit_log = _audit_order(
        'refund_completed', order,
        metadata={'to_payment_status': Order.PaymentStatus.REFUNDED},
    )
    AdminNotificationService.notify_for_audit(
        audit_log,
        event_key=f'order-refunded:{order.pk}',
        message=f'Order {order.order_number} was refunded.',
        link=f'/admin/dashboard/orders/{order.pk}/',
    )
    if order.user is not None:
        notify_customer(
            order.user,
            'payment',
            'Refund processed',
            f'Your refund for order {order.order_number} has been processed.',
            link=f'/account/orders/{order.order_number}',
            event_key=f'customer-order-refunded:{order.pk}',
        )
    return order


@transaction.atomic
def cancel_order(order):
    if order.status == Order.Status.CANCELLED:
        return order
    if order.status not in (Order.Status.PENDING, Order.Status.CONFIRMED):
        raise ValidationError(
            {'status': 'Only pending or confirmed orders can be cancelled.'})

    for reservation in order.reservations.select_for_update().all():
        release_reservation(reservation)

    if order.payment_status == Order.PaymentStatus.PAID:
        order.payment_status = Order.PaymentStatus.REFUNDED

    previous_status = order.status
    order.status = Order.Status.CANCELLED
    order.save(update_fields=['status', 'payment_status', 'updated_at'])
    audit_log = _audit_order(
        'order_cancelled', order,
        metadata={'from': previous_status, 'to': Order.Status.CANCELLED,
                  'reason': 'cancelled'},
    )
    AdminNotificationService.notify_for_audit(
        audit_log,
        event_key=f'order-cancelled:{order.pk}',
        message=f'Order {order.order_number} was cancelled.',
        link=f'/admin/dashboard/orders/{order.pk}/',
    )
    if order.user is not None:
        notify_customer(
            order.user,
            'order',
            'Order cancelled',
            f'Your order {order.order_number} has been cancelled.',
            link=f'/account/orders/{order.order_number}',
            event_key=f'customer-order-cancelled:{order.pk}',
        )
    return order
