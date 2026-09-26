"""Promotions domain models.

Money is stored in minor units (KES cents) following the existing
catalog/orders convention (``price_minor`` / ``subtotal_minor``).
"""
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def normalize_coupon_code(raw):
    """Upper-case, whitespace-collapsed form used for matching + uniqueness."""
    if not raw:
        return ''
    return ' '.join(str(raw).split()).upper()


class Promotion(models.Model):
    class Type(models.TextChoices):
        PERCENTAGE = 'percentage', 'Percentage discount'
        FIXED = 'fixed', 'Fixed amount discount'
        FREE_SHIPPING = 'free_shipping', 'Free shipping'
        BUY_X_GET_Y = 'buy_x_get_y', 'Buy X Get Y free'
        BUY_X_GET_PCT = 'buy_x_get_pct', 'Buy X Get % off'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        SCHEDULED = 'scheduled', 'Scheduled'
        EXPIRED = 'expired', 'Expired'
        DISABLED = 'disabled', 'Disabled'

    class CustomerScope(models.TextChoices):
        ALL = 'all', 'Everyone'
        NEW = 'new', 'New customers'
        EXISTING = 'existing', 'Existing customers'
        SPECIFIC = 'specific', 'Specific customers'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    promotion_type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)

    # Discount configuration (minor units except percentages).
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)])
    discount_amount_minor = models.PositiveIntegerField(default=0)
    maximum_discount_minor = models.PositiveIntegerField(null=True, blank=True)
    minimum_order_value_minor = models.PositiveIntegerField(default=0)
    minimum_quantity = models.PositiveIntegerField(default=0)

    # Buy X Get Y / Buy X Get % off configuration.
    qualifying_quantity = models.PositiveIntegerField(default=0)
    reward_quantity = models.PositiveIntegerField(default=0)
    reward_discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)])
    max_redemptions_per_order = models.PositiveIntegerField(null=True, blank=True)

    # Coupon configuration.
    coupon_code = models.CharField(max_length=60, blank=True)
    coupon_code_normalized = models.CharField(max_length=60, blank=True, db_index=True)
    is_automatic = models.BooleanField(default=False)

    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    usage_limit_per_customer = models.PositiveIntegerField(null=True, blank=True)

    priority = models.IntegerField(default=10)
    stackable = models.BooleanField(default=False)

    # Targeting flags.
    eligible_all = models.BooleanField(default=True)
    sale_only = models.BooleanField(default=False)
    new_only = models.BooleanField(default=False)

    customer_scope = models.CharField(
        max_length=12, choices=CustomerScope.choices, default=CustomerScope.ALL)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='promotions_created')
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='promotions_updated')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-priority', '-created_at')
        indexes = [
            models.Index(fields=('status',)),
            models.Index(fields=('coupon_code_normalized',)),
            models.Index(fields=('is_automatic', 'status')),
            models.Index(fields=('starts_at', 'ends_at')),
            models.Index(fields=('-priority',)),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(discount_percent__gte=0) & models.Q(discount_percent__lte=100),
                name='promo_percent_range'),
            models.CheckConstraint(
                condition=models.Q(reward_discount_percent__gte=0) & models.Q(reward_discount_percent__lte=100),
                name='promo_reward_percent_range'),
        ]

    def save(self, *args, **kwargs):
        self.coupon_code_normalized = normalize_coupon_code(self.coupon_code)
        if not self.coupon_code.strip():
            self.coupon_code = ''
            self.coupon_code_normalized = ''
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.promotion_type})'


class PromotionProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='promo_products')
    product = models.ForeignKey('catalog.Product', on_delete=models.CASCADE, related_name='promotion_links')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('promotion', 'product'), name='unique_promo_product'),
        ]


class PromotionCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='promo_categories')
    category = models.ForeignKey('catalog.Category', on_delete=models.CASCADE, related_name='promotion_links')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('promotion', 'category'), name='unique_promo_category'),
        ]


class PromotionVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='promo_variants')
    variant = models.ForeignKey('catalog.ProductVariant', on_delete=models.CASCADE, related_name='promotion_links')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('promotion', 'variant'), name='unique_promo_variant'),
        ]


class PromotionCustomer(models.Model):
    """Explicit allow-list used when ``customer_scope == specific``."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='promo_customers')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='promotion_links')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('promotion', 'user'), name='unique_promo_customer'),
        ]


class PromotionRedemption(models.Model):
    """Immutable usage record — the source of truth for limits (race-safe)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promotion = models.ForeignKey(Promotion, on_delete=models.PROTECT, related_name='redemptions')
    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, related_name='promo_redemptions')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='promotion_redemptions')
    cart_key = models.CharField(max_length=100, blank=True)
    coupon_code = models.CharField(max_length=60, blank=True)
    discount_minor = models.PositiveIntegerField(default=0)
    shipping_discount_minor = models.PositiveIntegerField(default=0)
    voided = models.BooleanField(default=False)
    redeemed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-redeemed_at',)
        indexes = [
            models.Index(fields=('promotion', 'voided')),
            models.Index(fields=('user',)),
            models.Index(fields=('order',)),
        ]
        constraints = [
            models.UniqueConstraint(fields=('promotion', 'order'), name='unique_promo_order'),
        ]
