from rest_framework import serializers

from .models import Category, Product, ProductVariant


def major_units(minor_units):
    return minor_units / 100


class CategorySerializer(serializers.ModelSerializer):
    imageUrl = serializers.CharField(source='image_url', allow_blank=True)
    isActive = serializers.BooleanField(source='is_active')

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'imageUrl', 'isActive')


class ProductVariantSerializer(serializers.ModelSerializer):
    colorHex = serializers.CharField(source='color_hex', allow_blank=True)
    stockQuantity = serializers.IntegerField(source='stock_quantity')
    isAvailable = serializers.SerializerMethodField()
    isActive = serializers.BooleanField(source='is_active')
    price = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ('id', 'sku', 'size', 'color', 'colorHex', 'price',
                  'stockQuantity', 'isAvailable', 'isActive', 'images')

    def get_price(self, obj):
        return major_units(obj.price_minor if obj.price_minor is not None else obj.product.price_minor)

    def get_images(self, obj):
        request = self.context.get('request')
        urls = [image.image_url for image in obj.variant_images.all() if image.image_url]
        if request:
            return [request.build_absolute_uri(url) if url.startswith('/') else url for url in urls]
        return urls

    def get_isAvailable(self, obj):
        return obj.is_active and obj.stock_quantity > 0


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    compareAtPrice = serializers.SerializerMethodField()
    isFeatured = serializers.BooleanField(source='is_featured')
    isNewArrival = serializers.BooleanField(source='is_new_arrival')
    isBestSeller = serializers.BooleanField(source='is_best_seller')
    createdAt = serializers.DateTimeField(source='created_at')
    updatedAt = serializers.DateTimeField(source='updated_at')
    price = serializers.SerializerMethodField()
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'tagline', 'description', 'details', 'price', 'compareAtPrice',
            'category', 'images', 'status', 'isFeatured', 'isNewArrival', 'isBestSeller',
            'variants', 'createdAt', 'updatedAt',
        )

    def get_category(self, obj):
        return {'id': str(obj.category_id), 'name': obj.category.name, 'slug': obj.category.slug}

    def get_images(self, obj):
        request = self.context.get('request')
        images = Product.normalize_images(obj.images)
        if request:
            return [request.build_absolute_uri(image) if image.startswith('/') else image for image in images]
        return images

    def get_price(self, obj):
        return major_units(obj.price_minor)

    def get_compareAtPrice(self, obj):
        return major_units(obj.compare_at_price_minor) if obj.compare_at_price_minor is not None else None
