"""Email types, retry policy and per-type metadata for the centralised mailer.

Everything here is deliberately data, not behaviour: ``services`` owns the
lifecycle, ``senders`` owns rendering, and this module is the single place an
operator looks to see what can be sent and how hard the system tries.
"""

#: (value, label) pairs. Stored on ``EmailLog.email_type`` and reused by the
#: admin filter dropdown, so adding a type means one migration.
EMAIL_TYPE_CHOICES = (
    # --- customer-facing -------------------------------------------------
    ('order_confirmation', 'Order confirmation'),
    ('order_confirmed', 'Order confirmed'),
    ('order_cancelled', 'Order cancelled'),
    ('order_received', 'Order received'),
    ('payment_success', 'Payment successful'),
    ('payment_failed', 'Payment failed'),
    ('receipt', 'Receipt'),
    ('welcome', 'Welcome'),
    ('back_in_stock', 'Back in stock'),
    ('promotion_announcement', 'Promotion announcement'),
    ('promotion_ending_soon', 'Promotion ending soon'),
    ('coupon_issued', 'Coupon issued'),
    # --- staff-facing ----------------------------------------------------
    ('admin_new_order', 'Admin: new order'),
    ('admin_payment_failed', 'Admin: payment failed'),
    ('admin_low_stock', 'Admin: low stock'),
    ('admin_critical_error', 'Admin: critical system error'),
    # --- bulk import -----------------------------------------------------
    ('bulk_import_completed', 'Bulk import completed'),
    ('bulk_import_failed', 'Bulk import failed'),
)

ALLOWED_EMAIL_TYPES = frozenset(value for value, _ in EMAIL_TYPE_CHOICES)

#: Types that reach a customer (and may therefore create an in-app
#: ``CustomerNotification`` on successful delivery).
CUSTOMER_EMAIL_TYPES = frozenset({
    'order_confirmation', 'order_confirmed', 'order_cancelled',
    'order_received', 'payment_success', 'payment_failed', 'receipt',
    'welcome', 'back_in_stock',
    'promotion_announcement', 'promotion_ending_soon', 'coupon_issued',
})

ADMIN_EMAIL_TYPES = ALLOWED_EMAIL_TYPES - CUSTOMER_EMAIL_TYPES

#: 30s / 2m / 10m / 30m, then FAILED: five attempts in total, matching the
#: documented ladder. A uniform +/-20% jitter keeps a broker or SMTP outage
#: from making every queued message retry in lockstep.
EMAIL_RETRY_DELAYS = (30, 120, 600, 1800)
MAX_ATTEMPTS = 5
JITTER_RATIO = 0.2

#: Rough cap on the stored plain-text body; anything longer is truncated rather
#: than allowed to bloat ``EmailLog``.
MAX_BODY_CHARS = 20000
