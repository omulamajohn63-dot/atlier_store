"""Shared vocabulary for the Modeza audit trail.

Every action recorded by :class:`audit.services.AuditLogService` must map to
one of the canonical events below. Unknown actions are coerced to
``security_event`` (with a warning log) so the admin Activity Logs view never
sees free-form action strings.
"""

# Canonical audit actions. Client-sendable events are a strict subset.
AUDIT_ACTIONS = (
    "create",
    "update",
    "delete",
    "login",
    "logout",
    "login_failed",
    "signup",
    "password_reset",
    "permission_denied",
    "access_denied",
    "status_change",
    "payment_initiated",
    "payment_success",
    "payment_failed",
    "refund",
    "checkout_started",
    "checkout_failed",
    "file_upload",
    "file_delete",
    "server_error",
    "security_event",
)

# Events the browser storefront is allowed to emit via POST /api/audit/events.
# Backend-only actions (create/update/delete/...) are rejected here so clients
# cannot forge privileged audit records.
CLIENT_EVENT_WHITELIST = {
    "signup",
    "login",
    "logout",
    "login_failed",
    "password_reset",
    "checkout_started",
    "checkout_failed",
    "payment_failed",
    "security_event",
}

AUDIT_CATEGORIES = (
    "auth",
    "account",
    "catalog",
    "inventory",
    "orders",
    "payments",
    "file",
    "security",
    "system",
    "api_client",
)

RESULTS = ("success", "failure")
SEVERITIES = ("info", "medium", "high", "critical")

# Default category per action when a call site does not pass one explicitly.
CATEGORY_BY_ACTION = {
    "create": "catalog",
    "update": "catalog",
    "delete": "catalog",
    "login": "auth",
    "logout": "auth",
    "login_failed": "auth",
    "signup": "account",
    "password_reset": "account",
    "permission_denied": "security",
    "access_denied": "security",
    "status_change": "orders",
    "payment_initiated": "payments",
    "payment_success": "payments",
    "payment_failed": "payments",
    "refund": "payments",
    "checkout_started": "orders",
    "checkout_failed": "orders",
    "file_upload": "file",
    "file_delete": "file",
    "server_error": "system",
    "security_event": "security",
}

# Default severity when a call site does not pass one explicitly.
SEVERITY_BY_ACTION = {
    "login_failed": "medium",
    "permission_denied": "medium",
    "access_denied": "critical",
    "security_event": "high",
    "server_error": "high",
    "payment_failed": "medium",
    "checkout_failed": "medium",
    "delete": "medium",
    "refund": "medium",
    "password_reset": "medium",
}


def coerce_action(value):
    """Return a canonical audit action, coercing unknown values to
    ``security_event``."""
    if value in AUDIT_ACTIONS:
        return value
    return "security_event"


def coerce_category(value):
    if value in AUDIT_CATEGORIES:
        return value
    return ""