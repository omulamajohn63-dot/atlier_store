from rest_framework import serializers

from audit.models import AuditLog
from catalog.serializers import major_units

from .models import Order, OrderItem

# Real, backend-recorded order milestones. Every event is derived from the
# immutable audit trail (never invented), so customers always see genuine
# history with timestamps that match what staff observe back-office.
TIMELINE_ACTIONS = (
    'order_created',
    'payment_success',
    'order_confirmed',
    'status_change',
    'order_received',
    'order_cancelled',
)

TIMELINE_LABELS = {
    'order_created': ('confirmed', 'Order Placed',
                      'We received your order and registered it in the modeza database.'),
    'payment_success': ('confirmed', 'Payment Received',
                        'Payment was received and verified for this order.'),
    'order_confirmed': ('confirmed', 'Order Confirmed',
                        'Your order was confirmed by the boutique.'),
    'order_received': ('received', 'Order Received',
                       'You marked this order as received.'),
    'order_cancelled': ('cancelled', 'Order Cancelled',
                        'Your order was cancelled and any reserved stock was returned.'),
}


class OrderItemSerializer(serializers.ModelSerializer):
    productId = serializers.SerializerMethodField()
    variantId = serializers.SerializerMethodField()
    productName = serializers.CharField(source='product_name')
    variantSku = serializers.CharField(source='variant_sku')
    variantSize = serializers.CharField(source='variant_size')
    variantColor = serializers.CharField(source='variant_color')
    imageUrl = serializers.SerializerMethodField()
    unitPrice = serializers.SerializerMethodField()
    lineTotal = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ('id', 'productId', 'variantId', 'productName', 'variantSku',
                  'variantSize', 'variantColor', 'imageUrl', 'unitPrice', 'quantity', 'lineTotal')

    def _image_url(self, image, request):
        if not image:
            return ''
        if image.startswith('http://') or image.startswith('https://'):
            return image
        if image.startswith('/') and request:
            return request.build_absolute_uri(image)
        if image.startswith('/'):
            return image
        return image

    def get_imageUrl(self, obj):
        request = self.context.get('request')
        return self._image_url(obj.image_url or '', request)

    def get_productId(self, obj):
        return str(obj.product_id) if obj.product_id else ''

    def get_variantId(self, obj):
        return str(obj.variant_id) if obj.variant_id else ''

    def get_unitPrice(self, obj):
        return major_units(obj.unit_price_minor)

    def get_lineTotal(self, obj):
        return major_units(obj.line_total_minor)


class OrderSerializer(serializers.ModelSerializer):
    orderNumber = serializers.CharField(source='order_number')
    cartId = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    shippingCost = serializers.SerializerMethodField()
    tax = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    shippingMethod = serializers.CharField(source='shipping_method')
    paymentMethod = serializers.CharField(source='payment_method')
    paymentStatus = serializers.CharField(source='payment_status')
    paymentIntentId = serializers.CharField(
        source='payment_intent_id', allow_blank=True)
    createdAt = serializers.DateTimeField(source='created_at')
    updatedAt = serializers.DateTimeField(source='updated_at')
    items = OrderItemSerializer(many=True, read_only=True)
    timeline = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ('id', 'orderNumber', 'cartId', 'customer', 'items', 'subtotal', 'shippingCost', 'tax', 'total',
                  'shippingMethod', 'paymentMethod', 'status', 'paymentStatus', 'paymentIntentId', 'currency', 'createdAt', 'updatedAt', 'timeline')

    def get_timeline(self, obj):
        """Real order history derived from the audit trail (newest last).

        ``status_change`` events carry ``metadata.to`` so lifecycle moves that
        are not their own audit action still surface as legit-timestamped steps.
        """
        events = []
        logs = (
            AuditLog.objects
            .filter(object_type='order', object_id=str(obj.pk),
                    action__in=TIMELINE_ACTIONS)
            .order_by('created_at', 'id')
        )
        for log in logs:
            if log.action == 'status_change':
                to_status = (log.metadata or {}).get('to')
                if not isinstance(to_status, str) or to_status not in Order.Status.values:
                    continue
                status = to_status
                label = ' '.join(w.capitalize() for w in to_status.split('_'))
                title = f'{label}'
                description = log.description or f'Order status changed to {label}.'
            else:
                status, title, description = TIMELINE_LABELS[log.action]
            events.append({
                'status': status,
                'title': title,
                'description': description,
                'timestamp': log.created_at.isoformat(),
                'completed': True,
            })
        return events

    def get_cartId(self, obj):
        return obj.cart.cart_key if obj.cart else ''

    def get_subtotal(self, obj):
        return major_units(obj.subtotal_minor)

    def get_shippingCost(self, obj):
        return major_units(obj.shipping_cost_minor)

    def get_tax(self, obj):
        return major_units(obj.tax_minor)

    def get_total(self, obj):
        return major_units(obj.total_minor)
