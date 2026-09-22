from rest_framework import serializers

from catalog.serializers import major_units

from .models import Receipt


class ReceiptSerializer(serializers.ModelSerializer):
    receiptNumber = serializers.CharField(source='receipt_number')
    orderNumber = serializers.CharField(source='order.order_number')
    issueDate = serializers.DateTimeField(source='generated_at')
    gatewayReference = serializers.CharField(
        source='gateway_reference', allow_blank=True)
    checkoutRequestId = serializers.CharField(
        source='checkout_request_id', allow_blank=True)
    amount = serializers.SerializerMethodField()
    emailSentAt = serializers.DateTimeField(source='email_sent_at')
    downloadPath = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Receipt
        fields = (
            'id', 'receiptNumber', 'orderNumber', 'status', 'currency',
            'amount', 'issueDate', 'gatewayReference', 'checkoutRequestId',
            'emailSentAt', 'downloadPath', 'createdAt',
        )

    def get_amount(self, obj):
        return major_units(obj.amount_minor)

    def get_downloadPath(self, obj):
        return f'/api/receipts/{obj.receipt_number}/download'