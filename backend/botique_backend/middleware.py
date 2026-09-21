"""Request-scoped middleware for correlation and structured request logs."""

import logging
import time

from audit.context import current_request_context, request_context

http_logger = logging.getLogger("modeza.http")


class RequestContextMiddleware:
    """Attach a request ID and emit structured HTTP request logs.

    Placed immediately after ``SecurityMiddleware`` so the request ID, client
    IP and user agent are available to every view, exception handler and
    :class:`audit.services.AuditLogService` write for the whole request. The
    generated/echoed request ID is also written back to the response's
    ``X-Request-ID`` header for client correlation. Request bodies are never
    logged.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = getattr(request, "path", "")
        if path.startswith("/static/") or path.startswith("/media/"):
            return self.get_response(request)

        start = time.perf_counter()
        with request_context(request) as ctx:
            try:
                response = self.get_response(request)
            except Exception:
                duration_ms = (time.perf_counter() - start) * 1000
                http_logger.error(
                    _http_envelope(request, 500, duration_ms, ctx),
                    exc_info=True,
                )
                raise
            request_id = ctx.get("request_id") or ""

        duration_ms = (time.perf_counter() - start) * 1000
        if request_id:
            response["X-Request-ID"] = request_id
        http_logger.info(
            _http_envelope(request, response.status_code, duration_ms, ctx))
        return response


def _http_envelope(request, status_code, duration_ms, context=None):
    context = context or current_request_context()
    user = getattr(request, "user", None)
    user_id = ""
    if user is not None:
        try:
            if user.is_authenticated:
                user_id = str(getattr(user, "pk", ""))
        except Exception:
            user_id = ""
    return {
        "event": "http_request",
        "method": request.method,
        "path": getattr(request, "path", ""),
        "status_code": status_code,
        "duration_ms": round(duration_ms, 3),
        "request_id": context.get("request_id") or "",
        "user_id": user_id,
        "ip": context.get("ip_address") or "",
    }