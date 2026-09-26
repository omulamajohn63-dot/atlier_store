import uuid

from django.conf import settings
from django.db import models

from cart.models import Cart
from catalog.models import Product, ProductVariant


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        PROCESSING = 'processing', 'Processing'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'
        RECEIVED = 'received', 'Received'
        CANCELLED = 'cancelled', 'Cancelled'

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'
        REFUNDED = 'refunded', 'Refunded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=32, unique=True)
    cart = models.ForeignKey(Cart, null=True, blank=True,
                             on_delete=models.SET_NULL, related_name='orders')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True,
                             blank=True, on_delete=models.SET_NULL, related_name='orders')
    customer = models.JSONField(default=dict)
    notes = models.CharField(max_length=500, blank=True)
    subtotal_minor = models.PositiveIntegerField()
    discount_minor = models.PositiveIntegerField(default=0)
    shipping_cost_minor = models.PositiveIntegerField(default=0)
    shipping_discount_minor = models.PositiveIntegerField(default=0)
    tax_minor = models.PositiveIntegerField(default=0)
    total_minor = models.PositiveIntegerField()
    coupon_code = models.CharField(max_length=60, blank=True, default='')
    promotion_snapshot = models.JSONField(default=dict, blank=True)
    shipping_method = models.CharField(max_length=10, default='standard')
    payment_method = models.CharField(max_length=30, default='mpesa')
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING)
    payment_status = models.CharField(
        max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    payment_intent_id = models.CharField(max_length=100, blank=True)
    currency = models.CharField(max_length=3, default='KES')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL)
    variant = models.ForeignKey(
        ProductVariant, null=True, blank=True, on_delete=models.SET_NULL)
    product_name = models.CharField(max_length=200)
    variant_sku = models.CharField(max_length=80)
    variant_size = models.CharField(max_length=40, blank=True)
    variant_color = models.CharField(max_length=80, blank=True)
    image_url = models.URLField(blank=True)
    unit_price_minor = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()
    line_total_minor = models.PositiveIntegerField()
