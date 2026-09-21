from rest_framework import serializers


class ClientEventSerializer(serializers.Serializer):
    """Validates reports posted by the browser storefront."""

    event = serializers.CharField(max_length=40)
    category = serializers.CharField(max_length=40, required=False, allow_blank=True)
    description = serializers.CharField(
        max_length=2000, required=False, allow_blank=True)
    context = serializers.DictField(required=False)
    data = serializers.DictField(required=False)