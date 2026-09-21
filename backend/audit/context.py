"""Request-scoped correlation state.

A single :data:`contextvars.ContextVar` carries the active request, its request
ID, client IP and user agent for the lifetime of the request. It is populated
by :class:`botique_backend.middleware.RequestContextMiddleware` and consumed by
:class:`audit.services.AuditLogService`, the request logging filter and
:func:`botique_backend.exceptions.api_exception_handler`.
"""

import contextlib
import contextvars
import re
import uuid

from django.conf import settings

_REQUEST_CONTEXT = contextvars.ContextVar(
    "modeza_request_context", default=None)

# Incoming X-Request-ID headers are honoured only when they match a safe
# shape, preventing header injection of arbitrary log/audit content.
INCOMING_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def generate_request_id():
    return f"req_{uuid.uuid4().hex}"


def resolve_request_id(request):
    incoming = request.META.get("HTTP_X_REQUEST_ID", "")
    if incoming and INCOMING_REQUEST_ID_RE.match(incoming):
        return incoming
    return generate_request_id()


def resolve_client_ip(request):
    if settings.USE_X_FORWARDED_FOR:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def resolve_user_agent(request):
    return (request.META.get("HTTP_USER_AGENT") or "")[:300]


@contextlib.contextmanager
def request_context(request):
    context = {
        "request": request,
        "request_id": resolve_request_id(request),
        "ip_address": resolve_client_ip(request),
        "user_agent": resolve_user_agent(request),
    }
    token = _REQUEST_CONTEXT.set(context)
    try:
        yield context
    finally:
        _REQUEST_CONTEXT.reset(token)


def current_request_context():
    return _REQUEST_CONTEXT.get() or {}


def current_request_id():
    return current_request_context().get("request_id") or ""