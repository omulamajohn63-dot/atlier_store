import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from catalog.models import ProductVariant


class Cart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart_key = models.CharField(max_length=100, unique=True)
    coupon_code = models.CharField(max_length=60, blank=True, default='')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='carts',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        Cart, on_delete=models.CASCADE, related_name='items')
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.PROTECT, related_name='cart_items')
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=('cart', 'variant'), name='unique_cart_variant'),
        ]
