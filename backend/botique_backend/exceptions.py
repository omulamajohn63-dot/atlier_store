"""DRF exception handling: safe error envelopes + audit/logging hooks.

Outgoing API errors keep the existing ``{"error": {"code", "message",
"details"}}`` envelope for backward compatibility with the storefront's
``apiClient`` and gain a top-level ``request_id``. Handled exceptions are
logged; unhandled ones produce a safe 500 envelope (traceback stays
server-side). 401/403/checkout failures are additionally written to the audit
trail.
"""

import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler

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


def api_exception_handler(exc, context):
    request = context.get('request')
    response = exception_handler(exc, context)

    if response is not None:
        status = response.status_code
        detail = response.data.get('detail') if isinstance(
            response.data, dict) else response.data
        if isinstance(detail, dict):
            details = detail
            message = 'Request validation failed.'
        else:
            details = {}
            message = str(detail)
        code = STATUS_CODES.get(status, getattr(
            exc, 'default_code', 'api_error').upper())
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

    # Security/audit hooks. AuditLogService never raises.
    if status == 401:
        AuditLogService.log(
            'login_failed',
            category='auth',
            result='failure',
            severity='medium',
            description='API authentication failed.',
            metadata={'path': getattr(request, 'path', '') if request else ''},
            path=getattr(request, 'path', '') if request else '',
            status_code=status,
        )
    elif status == 403:
        AuditLogService.log(
            'permission_denied',
            category='security',
            result='failure',
            severity='medium',
            description='Authorization denied for API request.',
            metadata={'path': getattr(request, 'path', '') if request else ''},
            path=getattr(request, 'path', '') if request else '',
            status_code=status,
        )
    elif (
        status == 400
        and request is not None
        and request.path.startswith('/api/orders')
    ):
        AuditLogService.log(
            'checkout_failed',
            category='orders',
            result='failure',
            severity='medium',
            description='Checkout rejected by the backend.',
            metadata={'path': request.path},
            path=request.path,
            status_code=status,
        )
    elif status == 500:
        AuditLogService.log(
            'server_error',
            category='system',
            result='failure',
            severity='high',
            description='Unhandled server error on API request.',
            metadata={'path': getattr(request, 'path', '') if request else ''},
            path=getattr(request, 'path', '') if request else '',
            status_code=status,
        )

    if response is not None:
        response.data = payload
        return response
    return Response(payload, status=500)