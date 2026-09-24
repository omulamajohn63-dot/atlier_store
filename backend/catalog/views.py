from uuid import UUID

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.services import subscribe_to_stock_alert

from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class BackInStockView(APIView):
    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        variant_id = data.get('variantId', '')
        email = data.get('email', '')
        try:
            _, created = subscribe_to_stock_alert(variant_id, email)
        except Exception as exc:  # noqa: BLE001 - normalise to API contract
            error = getattr(exc, 'detail', None)
            if isinstance(error, dict):
                return Response(
                    {'error': {'code': 'VALIDATION_ERROR',
                               'message': 'Subscription could not be saved.',
                               'details': error}},
                    status=400)
            raise
        return Response({
            'ok': True,
            'alreadySubscribed': not created,
            'message': 'We will notify you when this item is back in stock.',
        }, status=201 if created else 200)


class ProductListView(APIView):
    def get(self, request):
        products = Product.objects.filter(
            status=Product.Status.ACTIVE,
            category__is_active=True,
        ).select_related('category').prefetch_related(
            'product_images', 'variants__variant_images')
        category = request.query_params.get('category')
        search = request.query_params.get('search', '').strip()
        sort = request.query_params.get('sort', 'newest')
        page = max(int(request.query_params.get('page', 1)), 1)
        limit = min(max(int(request.query_params.get('limit', 20)), 1), 100)

        if category and category != 'all':
            category_filter = Q(category__slug=category)
            try:
                UUID(category)
            except ValueError:
                pass
            else:
                category_filter |= Q(category_id=category)
            products = products.filter(category_filter)
        if search:
            products = products.filter(Q(name__icontains=search) | Q(
                description__icontains=search) | Q(tagline__icontains=search))
        if sort in ('price_asc', 'price:asc'):
            products = products.order_by('price_minor')
        elif sort in ('price_desc', 'price:desc'):
            products = products.order_by('-price_minor')
        elif sort == 'name':
            products = products.order_by('name')
        elif sort == 'featured':
            products = products.order_by('-is_featured', '-created_at')
        else:
            products = products.order_by('-created_at')

        total = products.count()
        total_pages = max((total + limit - 1) // limit, 1)
        products = products[(page - 1) * limit:page * limit]
        return Response({
            'data': ProductSerializer(products, many=True,
                                      context={'request': request}).data,
            'pagination': {'page': page, 'limit': limit, 'total': total, 'totalPages': total_pages},
        })


class ProductDetailView(APIView):
    def get(self, request, identifier):
        product_lookup = Q(slug=identifier)
        try:
            UUID(identifier)
        except ValueError:
            pass
        else:
            product_lookup |= Q(id=identifier)
        product = get_object_or_404(
            Product.objects.select_related(
                'category').prefetch_related('product_images', 'variants__variant_images'),
            product_lookup,
            status=Product.Status.ACTIVE,
            category__is_active=True,
        )
        return Response(ProductSerializer(
            product, context={'request': request}).data)


class CategoryListView(APIView):
    def get(self, request):
        categories = Category.objects.filter(is_active=True)
        return Response(CategorySerializer(categories, many=True).data)


class CategoryDetailView(APIView):
    def get(self, request, slug):
        category = get_object_or_404(Category, slug=slug, is_active=True)
        products = category.products.filter(
            status=Product.Status.ACTIVE).prefetch_related(
                'product_images', 'variants__variant_images')
        return Response({
            'category': CategorySerializer(category).data,
            'products': ProductSerializer(
                products, many=True, context={'request': request}).data,
        })
