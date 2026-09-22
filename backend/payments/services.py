import secrets
import uuid

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from admin_ui.models import notify_customer
from admin_ui.services import AdminNotificationService
from audit.services import AuditLogService
from inventory.models import StockReservation
from orders.models import Order
from receipts.services import generate_receipt

from .models import PaymentEvent, PaymentIntent


def get_order_for_cart(order_number, cart_key):
    try:
        order = Order.objects.select_related(
            'cart').get(order_number=order_number)
    except Order.DoesNotExist as exc:
        raise NotFound('Order was not found.') from exc
    if not cart_key or not order.cart or order.cart.cart_key != cart_key:
        raise PermissionDenied('You cannot access this order.')
    return order


@transaction.atomic
def create_intent(order_number, method, phone_number, cart_key):
    order = get_order_for_cart(order_number, cart_key)
    if order.payment_status == Order.PaymentStatus.PAID:
        raise ValidationError({'order': 'Order is already paid.'})
    existing = PaymentIntent.objects.filter(
        order=order, status=PaymentIntent.Status.PENDING).first()
    if existing:
        return existing
    intent_id = f'pi_{uuid.uuid4().hex}'
    intent = PaymentIntent.objects.create(
        id=intent_id,
        order=order,
        amount_minor=order.total_minor,
        method=method,
        client_secret=f'cs_{secrets.token_urlsafe(24)}',
        metadata={'phoneNumber': phone_number or order.customer.get(
            'phone', ''), 'mode': 'local-development'},
    )
    order.payment_intent_id = intent.id
    order.save(update_fields=['payment_intent_id', 'updated_at'])
    AuditLogService.log(
        'payment_initiated',
        object_type='payment_intent',
        object_id=intent.id,
        object_repr=order.order_number,
        category='payments',
        metadata={'method': method, 'order_number': order.order_number},
        status_code=201,
        description=f'Payment initiated for order {order.order_number}.',
    )
    return intent


@transaction.atomic
def _mark_intent_succeeded(intent, gateway_reference):
    intent.status = PaymentIntent.Status.SUCCEEDED
    intent.gateway_reference = gateway_reference or f'TXN-{uuid.uuid4().hex[:12].upper()}'
    intent.save(update_fields=['status', 'gateway_reference', 'updated_at'])
    order = intent.order
    StockReservation.objects.filter(order=order, status=StockReservation.Status.ACTIVE).update(
        status=StockReservation.Status.COMMITTED)
    order.payment_status = Order.PaymentStatus.PAID
    order.save(update_fields=['payment_status', 'updated_at'])
    audit_log = AuditLogService.log(
        'payment_success',
        object_type='order',
        object_id=order.pk,
        object_repr=order.order_number,
        category='payments',
        result='success',
        metadata={'gateway_reference': intent.gateway_reference},
        description=f'Payment succeeded for order {order.order_number}.',
    )
    AdminNotificationService.notify_for_audit(
        audit_log,
        event_key=f'payment-success:{order.pk}',
        message=f'Payment received for order {order.order_number}.',
        link=f'/admin/dashboard/orders/{order.pk}/',
    )
    if order.user is not None:
        notify_customer(
            order.user,
            'payment',
            'Payment received',
            f'Payment for order {order.order_number} was successful.',
            link=f'/account/orders/{order.order_number}',
            event_key=f'customer-payment-success:{order.pk}',
        )
    return order


@transaction.atomic
def confirm_payment(order_number, payment_intent_id, gateway_reference, cart_key):
    order = get_order_for_cart(order_number, cart_key)
    try:
        intent = PaymentIntent.objects.select_for_update().get(id=payment_intent_id)
    except PaymentIntent.DoesNotExist as exc:
        raise NotFound('Payment intent was not found.') from exc
    if intent.order_id != order.id:
        raise ValidationError(
            {'paymentIntentId': 'Payment intent does not belong to this order.'})
    if intent.status == PaymentIntent.Status.SUCCEEDED:
        return order
    if intent.status == PaymentIntent.Status.FAILED:
        raise ValidationError(
            {'paymentIntentId': 'Payment intent has failed.'})
    return _mark_intent_succeeded(intent, gateway_reference)


@transaction.atomic
def process_webhook(payload, signature, event_id):
    if not signature or not secrets.compare_digest(signature, settings.PAYMENT_WEBHOOK_SECRET):
        raise PermissionDenied('Invalid webhook signature.')
    event, data = payload.get('event'), payload.get('data', {})
    if not event_id:
        raise ValidationError({'eventId': 'Webhook event ID is required.'})
    if PaymentEvent.objects.filter(event_id=event_id).exists():
        return {'received': True, 'status': 'duplicate'}
    intent_id = data.get('paymentIntentId')
    intent = PaymentIntent.objects.filter(
        id=intent_id).first() if intent_id else None
    PaymentEvent.objects.create(
        event_id=event_id, payment_intent=intent, event_type=event or 'unknown', payload=payload)
    if event in ('payment_intent.succeeded', 'mpesa.stk_callback.success') and intent:
        order = _mark_intent_succeeded(intent, data.get('transactionId', ''))
        return {'received': True, 'status': 'order_marked_paid', 'orderNumber': order.order_number}
    if event in ('payment_intent.payment_failed', 'mpesa.stk_callback.failed') and intent:
        order = intent.order
        intent.status = PaymentIntent.Status.FAILED
        intent.save(update_fields=['status', 'updated_at'])
        audit_log = AuditLogService.log(
            'payment_timeout',
            object_type='order',
            object_id=order.pk,
            object_repr=order.order_number,
            category='payments',
            result='failure',
            metadata={'event': event, 'payment_intent_id': intent.id},
            description=f'Payment timed out for order {order.order_number}.',
        )
        AdminNotificationService.notify_for_audit(
            audit_log,
            event_key=f'payment-timeout:{order.pk}',
            message=f'Payment for order {order.order_number} did not complete.',
            link=f'/admin/dashboard/orders/{order.pk}/',
        )
        if order.user is not None:
            notify_customer(
                order.user,
                'payment',
                'Payment failed',
                f'Payment for order {order.order_number} did not complete. You can try again.',
                link=f'/account/orders/{order.order_number}',
                event_key=f'customer-payment-failed:{order.pk}',
            )
        return {'received': True, 'status': 'payment_failed', 'orderNumber': order.order_number}
    return {'received': True, 'status': 'unhandled_event'}
