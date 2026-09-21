from django.db import transaction
from rest_framework.exceptions import ValidationError

from audit.services import AuditLogService
from catalog.models import Product, ProductVariant

from .models import Cart, CartItem


def get_or_create_cart(cart_key, user=None):
    cart, _ = Cart.objects.get_or_create(
        cart_key=cart_key, defaults={'user': user})
    if user and cart.user_id is None:
        cart.user = user
        cart.save(update_fields=['user', 'updated_at'])
    return cart


def get_variant_for_cart(variant_id):
    try:
        return ProductVariant.objects.select_related('product').get(
            id=variant_id,
            is_active=True,
            product__status=Product.Status.ACTIVE,
            product__category__is_active=True,
        )
    except ProductVariant.DoesNotExist as exc:
        raise ValidationError(
            {'variantId': 'Variant is not available.'}) from exc


@transaction.atomic
def add_item(cart, variant_id, quantity):
    if quantity < 1:
        raise ValidationError({'quantity': 'Quantity must be at least 1.'})
    variant = get_variant_for_cart(variant_id)
    variant = ProductVariant.objects.select_for_update().get(pk=variant.pk)
    item, created = CartItem.objects.select_for_update().get_or_create(
        cart=cart, variant=variant, defaults={'quantity': quantity})
    prior_quantity = None
    if not created:
        prior_quantity = item.quantity
        quantity += item.quantity
        item.quantity = quantity
        item.save(update_fields=['quantity'])
    if quantity > variant.stock_quantity:
        raise ValidationError(
            {'quantity': f'Only {variant.stock_quantity} items are available.'})
    AuditLogService.log(
        'cart_item_added',
        category='orders',
        object_type='product_variant',
        object_id=variant.pk,
        object_repr=variant.sku,
        metadata={
            'product': variant.product.name,
            'variant_sku': variant.sku,
            'quantity': item.quantity,
            'created': created,
            'prior_quantity': prior_quantity,
        },
        description=f'Added {variant.sku} to cart ({item.quantity} units).',
    )
    return cart


@transaction.atomic
def update_item(cart, item_id, quantity):
    if quantity < 1:
        raise ValidationError({'quantity': 'Quantity must be at least 1.'})
    try:
        item = CartItem.objects.select_for_update().select_related(
            'variant').get(id=item_id, cart=cart)
    except CartItem.DoesNotExist as exc:
        raise ValidationError({'itemId': 'Cart item was not found.'}) from exc
    variant = ProductVariant.objects.select_for_update().get(pk=item.variant_id)
    if quantity > variant.stock_quantity:
        raise ValidationError(
            {'quantity': f'Only {variant.stock_quantity} items are available.'})
    prior_quantity = item.quantity
    item.quantity = quantity
    item.save(update_fields=['quantity'])
    AuditLogService.log(
        'cart_item_updated',
        category='orders',
        object_type='product_variant',
        object_id=variant.pk,
        object_repr=variant.sku,
        metadata={
            'product': variant.product.name,
            'variant_sku': variant.sku,
            'from_quantity': prior_quantity,
            'to_quantity': quantity,
        },
        description=f'Updated {variant.sku} quantity to {quantity}.',
    )
    return cart
