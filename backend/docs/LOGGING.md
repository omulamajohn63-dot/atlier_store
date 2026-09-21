# LOGGING.md — Logging, Audit Trail & Request Correlation

Modeza ships centralized, structured logging across the Django backend with a
shared audit trail, per-request correlation IDs, sanitization, and a
server-rendered Activity Logs page in the Django admin UI.

## Loggers

| Logger            | Emits                                                        |
| ----------------- | ------------------------------------------------------------ |
| `modeza.http`     | One `http_request` envelope per API request (no bodies)      |
| `modeza`          | Request-level INFO lines from the existing API middleware    |
| `audit`           | Audit write warnings and coercion notices                    |
| `django.request`  | Django request errors (ERROR level)                          |
| `django.server`   | Runserver request lines                                      |
| `django.db.backends` | SQL queries when `LOG_LEVEL=DEBUG`                        |
| `payments`, `orders`, `catalog`, `inventory`, `accounts`, `admin_api`, `admin_ui` | App namespace loggers |

All loggers propagate to a single console handler. Two formats exist and are
selected with `LOG_FORMAT`:

* `text` (default, human-readable): `level logger message … request_id=… user_id=… ip=…`
* `json` (production): the same envelope as JSON, one object per line with
  `request_id`, `request_user_id` and `request_ip` fields.

`RequestContextFilter` injects `request_id`, `request_user_id` and `request_ip`,
and `JsonFormatter` serializes dict messages into flat JSON.

## Request correlation

`RequestContextMiddleware` (right after `SecurityMiddleware`) assigns every
request a fresh ID:

* Incoming `X-Request-ID` is honored only when it matches `^[A-Za-z0-9_-]{8,64}$`.
* Otherwise a `req_<32 hex chars>` ID is generated.
* The ID is echoed back on the `X-Request-ID` response header and attached to
  every structured log line and audit record written during the request.
* Client IP comes from `REMOTE_ADDR` (or the first `X-Forwarded-For` entry when
  `USE_X_FORWARDED_FOR=True`, required behind Render's proxy).
* `/static/` and `/media/` requests are skipped entirely.

## Audit trail

All audit records are written through `audit.services.AuditLogService.log(...)`
and never raise. The service auto-derives actor, request ID, IP, user agent and
path from the active request; writes are deferred via `transaction.on_commit`
inside real atomic blocks so records from rolled-back operations never
survive.

Canonical events (see `audit/constants.py`) include `create`, `update`,
`delete`, `login`, `login_failed`, `signup`, `logout`, `password_reset`,
`permission_denied`, `access_denied`, `status_change`, `payment_initiated`,
`payment_success`, `payment_failed`, `refund`, `checkout_started`,
`checkout_failed`, `file_upload`, `file_delete`, `server_error`,
`security_event`. Unknown actions are coerced to `security_event` with a
warning.

### Client-side events

The browser storefront authenticates against Supabase entirely client-side, so
events like signup/login/checkout are reported by the frontend to
`POST /api/audit/events` (`audit/views.py`). The endpoint:

* requires a valid Supabase JWT (`IsAuthenticated`),
* throttles to `THROTTLE_AUDIT_RATE` (default `60/minute`),
* only accepts the whitelisted event subset in
  `constants.CLIENT_EVENT_WHITELIST`, coercing everything else to
  `security_event`,
* sanitizes all payload data before persistence, and
* responds `202 {received: true, action, request_id}`.

Frontend reporting lives in `frontend/src/lib/logger.ts` (fire-and-forget,
sensitive keys redacted) and is wired into `AuthContext`, `CheckoutPage`, the
API client (`x-request-id` capture) and `ErrorBoundary`.

### Security events

Invalid payment-webhook signatures (`payments/views.py`) and unauthorized
M-Pesa callbacks are logged as `security_event` with `severity=critical` before
the request is rejected. These writes happen outside the transaction that the
business logic runs in, so they always persist.

## Error handling

`botique_backend/exceptions.py` wraps every API error in a safe envelope —
`{"error": {code, message, details}, "request_id"}` (plus a generic message for
unhandled exceptions, never a traceback) — and audits 401/403/order-400 and
server-error events. Clients use the `request_id` to report correlated issues.

## Admin Activity & Logs center

The Django admin UI exposes a staff-only Activity & Logs center built on the
same read pipeline as the audit trail (`admin_ui/audit_ui.py`). All pages are
server-rendered, gated by `StaffRequiredMixin` (anonymous → `/admin/dashboard/login/`,
authenticated non-staff → 403 Access Denied page), and read directly from the
`AuditLog` table — no extra data is stored.

| Route | Page |
| ----- | ---- |
| `/admin/dashboard/activity/` | Overview: summary cards, timeline/table views, filters (event, category, result, severity, actor, free text, date range), sorting and CSV/JSON export |
| `/admin/dashboard/activity/errors/` | Error Center: failed requests, server errors and high/critical severity events |
| `/admin/dashboard/activity/request/<request_id>/` | Request Trace: chronological audit chain for one `req_<hex>` correlation ID |
| `/admin/dashboard/security/` | Security Center: logins, failed logins, permission denials, password resets and `security_event`s |
| `/admin/dashboard/system-health/` | System Health: live read-only checks (DB, API, auth config, storage, payments) that honestly report `Unknown`/`Configured` instead of inventing numbers |
| `/admin/dashboard/customers/<int:customer_id>/` | Customer profile with that account's audit activity and order history |

Order and product detail pages also render an "activity" card of events for the
record. `/admin/dashboard/audit-logs/` remains as a legacy alias of the overview.

Event metadata is sanitized server-side before display; the client drawer
additionally redacts any key matching
`password|passwd|token|secret|authoriz|bearer|api[-_]?key|cookie|jwt|credential`.

Exports reuse the exact server-side filter pipeline shown on screen (CSV or
JSON, capped at 10 000 rows, `format=csv|json`); any other format returns 400.

## Housekeeping

`python manage.py cleanup_audit_logs --days 365` deletes audit rows older than
the retention window (`AUDIT_LOG_RETENTION_DAYS`, default 365). Use
`--dry-run` to preview deletions. Run it on a schedule (e.g. a Render cron /
cron job) to keep the `audit_auditlog` table bounded.

## Environment

| Variable                  | Default             | Purpose                                        |
| ------------------------- | ------------------- | ---------------------------------------------- |
| `LOG_LEVEL`               | `INFO`              | Minimum structured log level                   |
| `LOG_FORMAT`              | `text`              | `text` or `json` console output                |
| `AUDIT_LOG_RETENTION_DAYS` | `365`              | AuditLog cleanup retention window              |
| `THROTTLE_AUDIT_RATE`     | `60/minute`         | Client audit event POST throttle               |
| `USE_X_FORWARDED_FOR`     | `False`             | Trust `X-Forwarded-For` for client IP          |