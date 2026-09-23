import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from catalog.models import ProductVariant


class StockReservation(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        RELEASED = 'released', 'Released'
        COMMITTED = 'committed', 'Committed'
        EXPIRED = 'expired', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        'orders.Order', on_delete=models.CASCADE, related_name='reservations')
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.PROTECT, related_name='reservations')
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)


class InventoryTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.PROTECT, related_name='inventory_transactions')
    quantity_delta = models.IntegerField()
    previous_quantity = models.PositiveIntegerField()
    new_quantity = models.PositiveIntegerField()
    reason = models.CharField(max_length=40)
    order = models.ForeignKey('orders.Order', null=True, blank=True,
                              on_delete=models.SET_NULL, related_name='inventory_transactions')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL,
                              null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)


class BackInStockRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        NOTIFIED = 'notified', 'Notified'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.CASCADE, related_name='back_in_stock_requests')
    email = models.EmailField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=('variant', 'email'),
                name='unique_back_in_stock_request'),
        ]

    def __str__(self):
        return f"{self.variant.sku} -> {self.email} ({self.status})"
