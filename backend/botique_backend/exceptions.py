"""DRF exception handling: safe error envelopes + audit/logging hooks.

Outgoing API errors keep the existing ``{"error": {"code", "message",
"details"}}`` envelope for backward compatibility with the storefront's
``apiClient`` and gain a top-level ``request_id``. Handled exceptions are
logged; unhandled ones produce a safe 500 envelope (traceback stays
server-side). 401/403/429 and meaningful customer failures (order creation,
cart mutations, payment flows) are written to the audit trail, notify the
admin (audit-linked) for the important ones, and are again self-healing —
audit/notify hooks never raise.
"""

import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler

from admin_ui.services import AdminNotificationService
from audit.services import AuditLogService

logger = logging.getLogger("modeza")


STATUS_CODES = {
    400: 'VALIDATION_ERROR',
    401: 'AUTHENTICATION_REQUIRED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
}

# DRF built-in default_codes. When a raised exception carries a custom
# default_code (e.g. QUANTITY_EXCEEDS_STOCK), that code wins so clients can
# branch on specific failures; generic DRF codes defer to STATUS_CODES.
DRF_GENERIC_CODES = frozenset({
    'error', 'invalid', 'not_authenticated', 'pending_authentication',
    'authentication_failed', 'permission_denied', 'method_not_allowed',
    'not_found', 'unsupported_media_type', 'throttled', 'not_acceptable',
    'parse_error', 'client_terminated',
})


def _error_code(exc, status):
    default_code = getattr(exc, 'default_code', '') or ''
    if default_code and default_code not in DRF_GENERIC_CODES:
        return default_code.upper()
    return STATUS_CODES.get(status, default_code.upper() or 'API_ERROR')


def _failure_path(request):
    return getattr(request, 'path', '') if request is not None else ''


def _audit_failure(request, status, **kwargs):
    """Write an audit + audit-linked notification for a rejected request.

    Never raises (both services swallow their own write errors)."""
    audit_log = AuditLogService.log(
        path=_failure_path(request),
        status_code=status,
        result='failure',
        metadata={
            'path': _failure_path(request),
            **kwargs.pop('metadata', {}),
        },
        **kwargs,
    )
    AdminNotificationService.notify_for_audit(audit_log)


def api_exception_handler(exc, context):
    request = context.get('request')
    response = exception_handler(exc, context)

    if response is not None:
        status = response.status_code
        data = response.data
        if isinstance(data, dict) and 'detail' in data:
            # Single DRF message error: expose it as the envelope message.
            details = {}
            message = str(data.get('detail', ''))
        elif isinstance(data, dict):
            # Field-level validation errors: forward the whole dict so the
            # storefront can surface per-field reasons from `details`. When
            # the exception carries a typed original (raw_details) prefer it
            # over DRF's stringified copy so numbers stay numbers in JSON.
            details = getattr(exc, 'raw_details', None)
            if not isinstance(details, dict):
                details = data
            message = 'Request validation failed.'
        else:
            details = {}
            message = str(data) if data is not None else ''
        code = _error_code(exc, status)
        payload = {
            'error': {'code': code, 'message': message, 'details': details},
        }
        logger.info(
            'API %s %s -> %s (%s)',
            getattr(request, 'method', ''),
            getattr(request, 'path', ''),
            status,
            code,
        )
    else:
        # Unhandled exception inside a DRF view: respond with a safe envelope
        # and keep the traceback server-side.
        status = 500
        payload = {
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'An unexpected server error occurred.',
                'details': {},
            },
        }
        logger.error(
            'Unhandled API exception at %s %s',
            getattr(request, 'method', ''),
            getattr(request, 'path', ''),
            exc_info=exc,
        )

    payload['request_id'] = AuditLogService.current_request_id()

    path = _failure_path(request)

    # Audit + notification hooks. AuditLogService and AdminNotificationService
    # never raise, so a failed write cannot break the error response itself.
    if status == 401:
        _audit_failure(
            request, status,
            action='login_failed',
            category='auth',
            severity='medium',
            description='API authentication failed.',
        )
    elif status == 403:
        _audit_failure(
            request, status,
            action='permission_denied',
            category='security',
            severity='medium',
            description='Authorization denied for API request.',
        )
    elif status == 429:
        # 429s on the audit endpoint itself are skipped entirely — they are
        # the storefront's safety valve and would otherwise flood the trail and
        # every admin inbox every time the client backs off.
        if not path.startswith('/api/audit'):
            _audit_failure(
                request, status,
                action='rate_limit_exceeded',
                category='system',
                severity='medium',
                description='API request rate limit exceeded.',
            )
    elif status == 400 and path.startswith('/api/orders'):
        _audit_failure(
            request, status,
            action='order_creation_failed',
            category='orders',
            severity='medium',
            description='Order creation rejected by the backend.',
        )
    elif (
        status in (400, 422)
        and path.startswith('/api/payments/create-intent')
    ):
        _audit_failure(
            request, status,
            action='payment_initiation_failed',
            category='payments',
            severity='medium',
            description='Payment initiation rejected by the backend.',
        )
    elif (
        status in (400, 422)
        and path.startswith('/api/payments/confirm')
    ):
        _audit_failure(
            request, status,
            action='payment_failed',
            category='payments',
            severity='medium',
            description='Payment confirmation failed.',
        )
    elif (
        status in (400, 409, 422)
        and path.startswith('/api/cart/merge')
    ):
        _audit_failure(
            request, status,
            action='cart_merge_failed',
            category='orders',
            severity='medium',
            description='Cart merge rejected by the backend.',
        )
    elif (
        status in (400, 409, 422)
        and path.startswith('/api/cart/items')
    ):
        action = ('cart_update_failed' if request.method == 'PATCH'
                  else 'cart_add_failed')
        _audit_failure(
            request, status,
            action=action,
            category='orders',
            severity='medium',
            description='Cart mutation rejected by the backend.',
        )
    elif status == 500:
        _audit_failure(
            request, status,
            action='unexpected_server_error',
            category='system',
            severity='high',
            description='Unhandled server error on API request.',
        )

    if response is not None:
        response.data = payload
        return response
    return Response(payload, status=500)