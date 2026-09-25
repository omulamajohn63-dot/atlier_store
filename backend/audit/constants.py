"""Shared vocabulary for the Modeza audit trail.

Every action recorded by :class:`audit.services.AuditLogService` must map to
one of the canonical events below. Unknown actions are coerced to
``security_event`` (with a warning log) so the admin Activity Logs view never
sees free-form action strings.
"""

# Canonical audit actions. Client-sendable events are a strict subset.
# The named taxonomy lets the admin logging UI group every meaningful customer
# activity (success or failure) without needing free-form action strings.
AUDIT_ACTIONS = (
    # Generic/administrative CRUD (staff only; backend-written).
    "create",
    "update",
    "delete",
    "file_upload",
    "file_delete",
    "bulk_import_started",
    "bulk_import_validated",
    "bulk_import_confirmed",
    "bulk_import_completed",
    "bulk_import_failed",
    "bulk_import_cancelled",
    "status_change",
    "refund",
    # Account lifecycle.
    "login",
    "logout",
    "login_failed",
    "signup",
    "customer_registered",
    "registration_failed",
    "password_reset",
    "password_updated",
    "profile_updated",
    # Catalog browsing (client-reported).
    "product_viewed",
    "category_viewed",
    "search_performed",
    # Cart lifecycle (backend-written).
    "cart_item_added",
    "cart_item_updated",
    "cart_item_removed",
    "cart_cleared",
    "cart_merged",
    "cart_add_failed",
    "cart_update_failed",
    "cart_merge_failed",
    # Order lifecycle.
    "checkout_started",
    "checkout_failed",
    "order_created",
    "order_creation_failed",
    "order_details_viewed",
    "order_cancelled",
    "order_confirmed",
    "order_received",
    # Payments.
    "payment_initiated",
    "payment_success",
    "payment_failed",
    "payment_initiation_failed",
    "payment_timeout",
    "payment_reversed",
    "refund_requested",
    "refund_completed",
    # Receipts (automatic, backend-written on payment success).
    "receipt_generated",
    "receipt_generation_failed",
    "receipt_regenerated",
    "receipt_downloaded",
    "receipt_email_sent",
    "receipt_email_failed",
    # Wishlist / reviews / support (client-reported; no dedicated backend).
    "wishlist_item_added",
    "wishlist_item_removed",
    "wishlist_cleared",
    "review_submitted",
    "support_message_submitted",
    # Back-in-stock alerts (backend-written).
    "back_in_stock_subscribed",
    "back_in_stock_notified",
    # Staff administration (backend-written; access_control).
    "staff_created",
    "staff_updated",
    "staff_deactivated",
    "staff_reactivated",
    "staff_role_changed",
    "role_created",
    "role_updated",
    "role_deleted",
    "permissions_granted",
    "permissions_revoked",
    # Security / system.
    "security_event",
    "permission_denied",
    "access_denied",
    "rate_limit_exceeded",
    "server_error",
    "unexpected_server_error",
    "inventory_low_stock",
    "email_retry_requested",
)

# Events the browser storefront is allowed to emit via POST /api/audit/events.
# Backend-only actions (create/update/delete/order_created/cart_item_added/...)
# are rejected here so clients cannot forge privileged audit records. Only
# events that are only observable client-side (Supabase auth, wishlist, product
# browsing, review/support forms) belong in this subset.
CLIENT_EVENT_WHITELIST = {
    "signup",
    "login",
    "logout",
    "login_failed",
    "registration_failed",
    "password_reset",
    "password_updated",
    "profile_updated",
    "product_viewed",
    "category_viewed",
    "search_performed",
    "checkout_started",
    "checkout_failed",
    "payment_failed",
    "payment_timeout",
    "refund_requested",
    "wishlist_item_added",
    "wishlist_item_removed",
    "wishlist_cleared",
    "review_submitted",
    "support_message_submitted",
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
    "staff",
    "roles",
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
    "customer_registered": "account",
    "registration_failed": "account",
    "password_reset": "account",
    "password_updated": "account",
    "profile_updated": "account",
    "permission_denied": "security",
    "access_denied": "security",
    "status_change": "orders",
    "product_viewed": "catalog",
    "category_viewed": "catalog",
    "search_performed": "catalog",
    "cart_item_added": "orders",
    "cart_item_updated": "orders",
    "cart_item_removed": "orders",
    "cart_cleared": "orders",
    "cart_merged": "orders",
    "cart_add_failed": "orders",
    "cart_update_failed": "orders",
    "cart_merge_failed": "orders",
    "order_created": "orders",
    "order_creation_failed": "orders",
    "order_details_viewed": "orders",
    "order_cancelled": "orders",
    "order_confirmed": "orders",
    "order_received": "orders",
    "checkout_started": "orders",
    "checkout_failed": "orders",
    "payment_initiated": "payments",
    "payment_success": "payments",
    "payment_failed": "payments",
    "payment_initiation_failed": "payments",
    "payment_timeout": "payments",
    "payment_reversed": "payments",
    "refund": "payments",
    "refund_requested": "payments",
    "refund_completed": "payments",
    "receipt_generated": "payments",
    "receipt_generation_failed": "payments",
    "receipt_regenerated": "payments",
    "receipt_downloaded": "payments",
    "receipt_email_sent": "payments",
    "receipt_email_failed": "payments",
    "wishlist_item_added": "catalog",
    "wishlist_item_removed": "catalog",
    "wishlist_cleared": "catalog",
    "back_in_stock_subscribed": "catalog",
    "back_in_stock_notified": "catalog",
    "review_submitted": "catalog",
    "support_message_submitted": "system",
    "file_upload": "file",
    "file_delete": "file",
    "bulk_import_started": "catalog",
    "bulk_import_validated": "catalog",
    "bulk_import_confirmed": "catalog",
    "bulk_import_completed": "catalog",
    "bulk_import_failed": "catalog",
    "bulk_import_cancelled": "catalog",
    "staff_created": "staff",
    "staff_updated": "staff",
    "staff_deactivated": "staff",
    "staff_reactivated": "staff",
    "staff_role_changed": "staff",
    "role_created": "roles",
    "role_updated": "roles",
    "role_deleted": "roles",
    "permissions_granted": "roles",
    "permissions_revoked": "roles",
    "rate_limit_exceeded": "system",
    "server_error": "system",
    "unexpected_server_error": "system",
    "inventory_low_stock": "inventory",
    "email_retry_requested": "system",
    "security_event": "security",
}

# Default severity when a call site does not pass one explicitly.
SEVERITY_BY_ACTION = {
    "login_failed": "medium",
    "registration_failed": "medium",
    "permission_denied": "medium",
    "access_denied": "critical",
    "security_event": "high",
    "server_error": "high",
    "unexpected_server_error": "high",
    "payment_failed": "medium",
    "payment_initiation_failed": "medium",
    "payment_timeout": "medium",
    "payment_reversed": "high",
    "checkout_failed": "medium",
    "order_creation_failed": "medium",
    "cart_add_failed": "medium",
    "cart_update_failed": "medium",
    "cart_merge_failed": "medium",
    "rate_limit_exceeded": "medium",
    "order_cancelled": "medium",
    "refund": "medium",
    "refund_requested": "medium",
    "refund_completed": "medium",
    "delete": "medium",
    "password_reset": "medium",
    "inventory_low_stock": "medium",
    "receipt_generation_failed": "high",
    "receipt_email_failed": "medium",
    "receipt_downloaded": "medium",
    "staff_deactivated": "high",
    "staff_created": "medium",
    "staff_updated": "medium",
    "staff_reactivated": "medium",
    "staff_role_changed": "high",
    "role_created": "medium",
    "role_updated": "medium",
    "role_deleted": "high",
    "permissions_granted": "high",
    "permissions_revoked": "medium",
    "email_retry_requested": "medium",
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