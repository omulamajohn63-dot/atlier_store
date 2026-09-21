from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsStaffOrAdmin
from audit.services import AuditLogService
from catalog.models import Category, Product, ProductVariant
from catalog.serializers import CategorySerializer, ProductSerializer
from inventory.services import adjust_stock, expire_reservations

from .serializers import CategoryWriteSerializer, ProductWriteSerializer, StockAdjustmentSerializer
from .services import create_product, update_product


class AdminAPIView(APIView):
    permission_classes = [IsStaffOrAdmin]
    throttle_scope = 'admin'


class AdminProductCreateView(AdminAPIView):
    def post(self, request):
        serializer = ProductWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = create_product(serializer.validated_data)
        AuditLogService.log(
            'create',
            object_type='product',
            object_id=product.pk,
            object_repr=product.name,
            category='catalog',
            status_code=201,
            description=f'Product created: {product.name}.',
        )
        return Response(ProductSerializer(product).data, status=201)


class AdminProductUpdateView(AdminAPIView):
    def patch(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        before = product_to_input(product)
        serializer = ProductWriteSerializer(
            before, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_product(product, serializer.validated_data)
        AuditLogService.log(
            'update',
            object_type='product',
            object_id=updated.pk,
            object_repr=updated.name,
            category='catalog',
            metadata={'changed': _field_diff(before, product_to_input(updated))},
            description=f'Product updated: {updated.name}.',
        )
        return Response(ProductSerializer(updated).data)


class AdminProductArchiveView(AdminAPIView):
    def post(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        previous = product.status
        product.status = Product.Status.ARCHIVED
        product.save(update_fields=['status', 'updated_at'])
        AuditLogService.log(
            'update',
            object_type='product',
            object_id=product.pk,
            object_repr=product.name,
            category='catalog',
            metadata={'status_changed': {'from': previous,
                                         'to': product.status}},
            description=f'Product archived: {product.name}.',
        )
        return Response(ProductSerializer(product).data)


class AdminCategoryCreateView(AdminAPIView):
    def post(self, request):
        serializer = CategoryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        category = Category.objects.create(
            name=data['name'], slug=data['slug'], description=data.get(
                'description', ''),
            is_active=data.get('isActive', True))
        AuditLogService.log(
            'create',
            object_type='category',
            object_id=category.pk,
            object_repr=category.name,
            category='catalog',
            status_code=201,
            description=f'Category created: {category.name}.',
        )
        return Response(CategorySerializer(category).data, status=201)


class AdminStockAdjustmentView(AdminAPIView):
    def patch(self, request, variant_id):
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variant = get_object_or_404(ProductVariant, pk=variant_id)
        adjust_stock(
            variant.id, serializer.validated_data['delta'], serializer.validated_data['reason'], request.user)
        variant.refresh_from_db()
        return Response({'variantId': str(variant.id), 'stockQuantity': variant.stock_quantity})


class ExpireReservationsView(AdminAPIView):
    def post(self, request):
        return Response({'expired': expire_reservations()})


def _field_diff(before, after):
    """Return {field: {'from': old, 'to': new}} for changed scalar fields."""
    changes = {}
    for key in after:
        if key in ('images', 'details'):
            continue
        if before.get(key) != after.get(key):
            changes[key] = {'from': before.get(key), 'to': after.get(key)}
    return changes


def product_to_input(product):
    return {
        'name': product.name, 'slug': product.slug, 'description': product.description,
        'tagline': product.tagline, 'details': product.details, 'price': product.price_minor / 100,
        'compareAtPrice': product.compare_at_price_minor / 100 if product.compare_at_price_minor is not None else None,
        'categoryId': product.category_id, 'images': product.images,
        'status': product.status, 'isFeatured': product.is_featured, 'isNewArrival': product.is_new_arrival,
        'isBestSeller': product.is_best_seller,
    }
