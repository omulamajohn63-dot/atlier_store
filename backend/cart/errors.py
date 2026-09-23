"""Structured cart errors.

Raising a custom :class:`rest_framework.exceptions.APIException` subclass
with a ``status_code`` outside the generic mapping lets the shared
``botique_backend.exceptions.api_exception_handler`` surface a concrete
machine-readable ``code`` (e.g. ``QUANTITY_EXCEEDS_STOCK``) while keeping the
existing ``{"error": {"code", "message", "details"}}`` envelope — field-level
``details`` stay backward compatible with the storefront's
``friendlyCartError``.
"""

from rest_framework.exceptions import APIException


class VariantUnavailableError(APIException):
    """The variant (or its product/category) is no longer purchasable."""

    status_code = 409
    default_code = 'VARIANT_NOT_AVAILABLE'
    default_detail = {'variantId': 'Variant is not available.'}

    def __init__(self, *, variant_id=None, message=None):
        detail = {
            'variantId': message or 'Variant is not available.',
            'code': self.default_code,
        }
        if variant_id is not None:
            detail['variant_id'] = str(variant_id)
        super().__init__(detail=detail)


class QuantityExceededError(APIException):
    """The requested quantity exceeds the currently available stock."""

    status_code = 409
    default_code = 'QUANTITY_EXCEEDS_STOCK'

    def __init__(self, *, variant_id, available, requested):
        unit = 'item' if available == 1 else 'items'
        raw_details = {
            'quantity': f'Only {available} {unit} are available.',
            'code': self.default_code,
            'available': available,
            'variantId': str(variant_id),
            'requestedQuantity': requested,
        }
        super().__init__(detail=raw_details)
        # DRF wraps every value into a str subclass (ErrorDetail); keep the
        # typed original so the shared handler (which reads `raw_details`) can
        # surface e.g. `available` as a real integer in the error envelope.
        self.raw_details = raw_details