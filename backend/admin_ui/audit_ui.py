"""Presentation and query helpers for the Modeza admin logging UI.

Everything here reads from the existing :class:`audit.models.AuditLog` model
and the canonical action/category vocabulary in ``audit.constants`` — it never
writes or duplicates audit data. The backend ``AuditLogService`` remains the
single writer of the audit trail.

Security note: metadata was already sanitized at write time, but the client
templates defensively redact sensitive-looking keys again before rendering.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import timedelta
from urllib.parse import urlencode

from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone

from audit.models import AuditLog

# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

# Canonical actions (see audit/constants.py) mapped to display labels. The
# backend stores snake_case actions and derives severity/result separately.
ACTION_META = {
    'create':              {'label': 'Created',                 'icon': 'ph-plus-circle'},
    'update':              {'label': 'Updated',                 'icon': 'ph-pencil-simple'},
    'delete':              {'label': 'Deleted',                 'icon': 'ph-trash'},
    'login':               {'label': 'Login',                   'icon': 'ph-sign-in'},
    'logout':              {'label': 'Logout',                  'icon': 'ph-sign-out'},
    'login_failed':        {'label': 'Login Failed',            'icon': 'ph-prohibit-inset'},
    'signup':              {'label': 'Account Created',         'icon': 'ph-user-plus'},
    'password_reset':      {'label': 'Password Reset',          'icon': 'ph-key'},
    'permission_denied':   {'label': 'Permission Denied',       'icon': 'ph-shield-slash'},
    'access_denied':       {'label': 'Access Denied',           'icon': 'ph-lock-key'},
    'status_change':       {'label': 'Status Changed',          'icon': 'ph-arrows-left-right'},
    'payment_initiated':   {'label': 'Payment Initiated',       'icon': 'ph-credit-card'},
    'payment_success':     {'label': 'Payment Successful',      'icon': 'ph-check-circle'},
    'payment_failed':      {'label': 'Payment Failed',          'icon': 'ph-x-circle'},
    'refund':              {'label': 'Refunded',                'icon': 'ph-arrow-u-up-left'},
    'checkout_started':    {'label': 'Checkout Started',        'icon': 'ph-shopping-cart'},
    'checkout_failed':     {'label': 'Checkout Failed',         'icon': 'ph-shopping-cart-simple'},
    'file_upload':         {'label': 'File Uploaded',           'icon': 'ph-upload-simple'},
    'file_delete':         {'label': 'File Deleted',            'icon': 'ph-file-x'},
    'server_error':        {'label': 'Server Error',            'icon': 'ph-warning-octagon'},
    'security_event':      {'label': 'Security Event',          'icon': 'ph-shield-warning'},
}

CATEGORY_META = {
    'auth':      {'label': 'Authentication', 'icon': 'ph-user-switch'},
    'account':   {'label': 'Account',        'icon': 'ph-user-circle'},
    'catalog':   {'label': 'Catalog',        'icon': 'ph-package'},
    'orders':    {'label': 'Orders',         'icon': 'ph-shopping-bag'},
    'payments':  {'label': 'Payments',       'icon': 'ph-currency-circle-dollar'},
    'inventory': {'label': 'Inventory',      'icon': 'ph-archive-box'},
    'file':      {'label': 'Files',          'icon': 'ph-file-text'},
    'security':  {'label': 'Security',       'icon': 'ph-shield'},
    'system':    {'label': 'System',         'icon': 'ph-gear-six'},
    'api_client': {'label': 'Storefront',    'icon': 'ph-globe'},
}

# Backend severity values are info/medium/high/critical. The UI maps these to
# user-facing labels and a shared tone so meaning never relies on color alone.
SEVERITY_META = {
    'info':     {'label': 'Info',       'tone': 'info',     'key': 'info'},
    'medium':   {'label': 'Warning',    'tone': 'warning',  'key': 'medium'},
    'high':     {'label': 'Error',      'tone': 'error',    'key': 'high'},
    'critical': {'label': 'Critical',   'tone': 'critical', 'key': 'critical'},
}

SEVERITY_ORDER = {'critical': 0, 'high': 1, 'medium': 2, 'info': 3}

SECURITY_ACTIONS = {
    'login', 'logout', 'login_failed', 'signup', 'password_reset',
    'permission_denied', 'access_denied', 'security_event',
}
ADMIN_ACTIONS = {
    'create', 'update', 'delete', 'status_change',
    'file_upload', 'file_delete', 'refund',
}
ERROR_ACTIONS = {'server_error', 'payment_failed', 'checkout_failed', 'login_failed'}
SUCCESS_ACTIONS = {'create', 'payment_success', 'login', 'signup', 'refund'}

RESOURCE_TYPE_LABELS = {
    'product': 'Product', 'order': 'Order', 'customer': 'Customer',
    'user': 'User', 'payment': 'Payment', 'payment_intent': 'Payment',
    'inventory': 'Inventory', 'category': 'Category', 'cart': 'Cart',
    'file': 'File', 'review': 'Review', 'wishlist': 'Wishlist',
}

RANGE_CHOICES = (
    ('today', 'Today'),
    ('yesterday', 'Yesterday'),
    ('7d', 'Last 7 days'),
    ('30d', 'Last 30 days'),
    ('90d', 'Last 90 days'),
    ('all', 'All time'),
    ('custom', 'Custom range'),
)

SORT_CHOICES = (('newest', 'Newest'), ('oldest', 'Oldest'), ('severity', 'Severity'))
VIEW_CHOICES = (('timeline', 'Timeline'), ('table', 'Table'))

_UUID_RE = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')


def is_uuid(value):
    return bool(value) and _UUID_RE.match(str(value)) is not None


def action_label(action):
    return (ACTION_META.get(action or '') or {}).get('label') or (
        (action or 'event').replace('_', ' ').title())


def action_icon(action):
    return (ACTION_META.get(action or '') or {}).get('icon') or 'ph-dot'


def category_label(category):
    return (CATEGORY_META.get(category or '') or {}).get('label') or (
        (category or 'record').replace('_', ' ').title())


def category_icon(category):
    return (CATEGORY_META.get(category or '') or {}).get('icon') or 'ph-folder'


def severity_meta(severity):
    return SEVERITY_META.get(severity or '', SEVERITY_META['info'])


def tone_for(log):
    """Overall visual tone for a log row (result + severity combined)."""
    severity = (log.severity or 'info')
    if log.result == 'failure':
        return 'critical' if severity == 'critical' else (
            'error' if severity == 'high' else 'warning')
    if severity == 'critical':
        return 'critical'
    if severity == 'high':
        return 'error'
    if severity == 'medium':
        return 'warning'
    if log.action in SUCCESS_ACTIONS:
        return 'success'
    return 'info'


def resource_label(log):
    obj_type_label = RESOURCE_TYPE_LABELS.get((log.object_type or '').lower())
    if not obj_type_label and log.object_type:
        obj_type_label = log.object_type.replace('_', ' ').title()
    if log.object_repr:
        return f'{obj_type_label} · {log.object_repr}' if obj_type_label else log.object_repr
    return obj_type_label or 'Record'


def resource_url(log):
    """Map an audit object to the most relevant existing admin page.

    Returns an empty string when no safe link is derivable; templates then
    render no link instead of a broken one. Only UUID object IDs are linked so
    free-form identifiers (order numbers, cart keys) never leak into URL paths.
    """
    obj_type = (log.object_type or '').lower()
    object_id = str(log.object_id or '')
    if obj_type in ('product', 'order', 'category', 'user', 'customer') and is_uuid(object_id):
        if obj_type == 'product':
            return f'/admin/dashboard/products/{object_id}/'
        if obj_type == 'order':
            return f'/admin/dashboard/orders/{object_id}/'
        if obj_type == 'category':
            return f'/admin/dashboard/categories/{object_id}/edit/'
        return f'/admin/dashboard/customers/{object_id}/'
    if obj_type in ('payment', 'payment_intent') and log.object_repr:
        return f'/admin/dashboard/orders/?{urlencode({"q": log.object_repr})}'
    return ''


def actor_display(log):
    if log.actor_id:
        actor = log.actor
        if actor:
            return actor.get_full_name() or actor.get_username() or (log.actor_email or 'Staff')
    if log.actor_email:
        return log.actor_email
    return 'System'


# ---------------------------------------------------------------------------
# Filters / search / sort / date ranges
# ---------------------------------------------------------------------------

def normalize_filters(params):
    """Read filter values from a request GET (QueryDict → plain dict)."""
    def clean(key, default=''):
        return (params.get(key) or default).strip()

    range_key = clean('range')
    if range_key not in {key for key, _ in RANGE_CHOICES}:
        range_key = '7d'
    view = clean('view', 'timeline')
    if view not in {key for key, _ in VIEW_CHOICES}:
        view = 'timeline'
    sort = clean('sort', 'newest')
    if sort not in {key for key, _ in SORT_CHOICES}:
        sort = 'newest'

    return {
        'q': clean('q'),
        'action': clean('action'),
        'category': clean('category'),
        'resource': clean('resource'),
        'severity': clean('severity'),
        'result': clean('result'),
        'actor': clean('actor'),
        'ip': clean('ip'),
        'request_id': clean('request_id'),
        'range': range_key,
        'date_from': clean('date_from'),
        'date_to': clean('date_to'),
        'view': view,
        'sort': sort,
    }


def resolve_date_range(filters):
    """Return ``(start_date, end_date, label)`` for the selected range."""
    today = timezone.localtime().date()
    key = filters.get('range', '7d')
    start = end = None
    label = 'Last 7 days'

    if key == 'today':
        start = end = today
        label = 'Today'
    elif key == 'yesterday':
        start = end = today - timedelta(days=1)
        label = 'Yesterday'
    elif key == '7d':
        start, end = today - timedelta(days=6), today
        label = 'Last 7 days'
    elif key == '30d':
        start, end = today - timedelta(days=29), today
        label = 'Last 30 days'
    elif key == '90d':
        start, end = today - timedelta(days=89), today
        label = 'Last 90 days'
    elif key == 'all':
        start, end, label = None, None, 'All time'
    elif key == 'custom':
        try:
            from django.utils.dateparse import parse_date
            parsed_from = parse_date(filters.get('date_from') or '')
            parsed_to = parse_date(filters.get('date_to') or '')
            if parsed_from or parsed_to:
                start, end = parsed_from, parsed_to
                label = 'Custom range'
            else:
                # Custom selected without dates → fall back to 7 days.
                start, end = today - timedelta(days=6), today
                label = 'Last 7 days'
        except (TypeError, ValueError):
            start, end = today - timedelta(days=6), today
            label = 'Last 7 days'
    return start, end, label


def build_query(filters, **overrides):
    """Build ``?key=value`` for the current filters with overrides applied."""
    data = dict(filters)
    for key, value in overrides.items():
        data[key] = value
    clean = {key: value for key, value in data.items() if value not in (None, '')}
    if not clean:
        return ''
    return f'?{urlencode(clean)}'


def apply_activity_filters(queryset, filters):
    """Apply server-side search, filters, range and sorting to an audit QuerySet."""
    start, end, _ = resolve_date_range(filters)
    if start:
        queryset = queryset.filter(created_at__date__gte=start)
    if end:
        queryset = queryset.filter(created_at__date__lte=end)

    action = filters.get('action')
    if action:
        queryset = queryset.filter(action=action)
    category = filters.get('category')
    if category:
        queryset = queryset.filter(category=category)
    resource = filters.get('resource')
    if resource:
        queryset = queryset.filter(object_type=resource)
    severity = filters.get('severity')
    if severity:
        queryset = queryset.filter(severity=severity)
    result = filters.get('result')
    if result:
        queryset = queryset.filter(result=result)

    actor = filters.get('actor')
    if actor:
        if is_uuid(actor):
            queryset = queryset.filter(actor_id=actor)
        else:
            queryset = queryset.filter(
                Q(actor__username__iexact=actor)
                | Q(actor__email__iexact=actor)
                | Q(actor_email__iexact=actor)
            )

    ip = filters.get('ip')
    if ip:
        queryset = queryset.filter(ip_address=ip)

    request_id = filters.get('request_id')
    if request_id:
        queryset = queryset.filter(request_id=request_id)

    query = filters.get('q')
    if query:
        queryset = queryset.filter(
            Q(request_id__icontains=query)
            | Q(object_repr__icontains=query)
            | Q(object_id__icontains=query)
            | Q(description__icontains=query)
            | Q(action__icontains=query)
            | Q(object_type__icontains=query)
            | Q(path__icontains=query)
            | Q(actor__username__icontains=query)
            | Q(actor__email__icontains=query)
            | Q(actor_email__icontains=query)
        )

    sort = filters.get('sort', 'newest')
    if sort == 'oldest':
        queryset = queryset.order_by('created_at', 'id')
    elif sort == 'severity':
        queryset = queryset.annotate(
            severity_rank=Case(
                *[When(severity=key, then=Value(idx))
                  for idx, key in enumerate(sorted(
                      SEVERITY_ORDER, key=SEVERITY_ORDER.get))],
                default=Value(99),
                output_field=IntegerField(),
            )
        ).order_by('severity_rank', '-created_at')
    else:
        queryset = queryset.order_by('-created_at', 'id')
    return queryset.select_related('actor')


def compute_summary(queryset):
    """Server-side summary counts, computed from the full filtered queryset."""
    total = queryset.count()
    admin_actions = queryset.filter(
        Q(actor__is_staff=True) | Q(action__in=ADMIN_ACTIONS)
    ).count()
    security_events = queryset.filter(
        Q(category='security') | Q(action__in=SECURITY_ACTIONS)
    ).count()
    errors = queryset.filter(
        Q(result='failure') | Q(severity__in=('high', 'critical'))
        | Q(action__in=ERROR_ACTIONS)
    ).count()
    payments = queryset.filter(category='payments').count()
    orders = queryset.filter(category='orders').count()
    active_admins = queryset.filter(
        actor__is_staff=True
    ).values('actor_id').distinct().count()
    return {
        'total': total,
        'admin_actions': admin_actions,
        'security_events': security_events,
        'errors': errors,
        'payments': payments,
        'orders': orders,
        'active_admins': active_admins,
    }


def decorate_audit_log(log):
    """Attach presentation attributes to an AuditLog instance for templates."""
    action = log.action or ''
    category = log.category or ''
    severity_key = (log.severity or 'info')
    if severity_key not in SEVERITY_META:
        severity_key = 'info'

    log.ui_action_label = action_label(action)
    log.ui_action_icon = action_icon(action)
    log.ui_category_label = category_label(category)
    log.ui_category_icon = category_icon(category)
    log.ui_severity_key = severity_key
    log.ui_severity_label = SEVERITY_META[severity_key]['label']
    log.ui_severity_tone = SEVERITY_META[severity_key]['tone']
    log.ui_tone = tone_for(log)
    log.ui_actor = actor_display(log)
    log.ui_actor_role = log.actor_role or (
        'Staff' if getattr(log.actor, 'is_staff', False) else 'Customer')
    log.ui_resource_label = resource_label(log)
    log.ui_resource_url = resource_url(log)
    log.ui_has_metadata = bool(log.metadata)
    log.ui_has_request = bool(log.request_id)
    log.ui_has_path = bool(log.path)
    log.ui_event_json = json.dumps({
        'action': action,
        'action_label': log.ui_action_label,
        'action_icon': log.ui_action_icon,
        'category': category,
        'category_label': log.ui_category_label,
        'category_icon': log.ui_category_icon,
        'severity_key': severity_key,
        'severity_label': log.ui_severity_label,
        'severity_tone': log.ui_severity_tone,
        'tone': log.ui_tone,
        'result': log.result or '',
        'actor': log.ui_actor,
        'actor_role': log.ui_actor_role,
        'actor_email': log.actor_email or '',
        'object_type': (log.object_type or '').replace('_', ' ').title(),
        'object_id': log.object_id or '',
        'object_repr': log.object_repr or '',
        'resource_label': log.ui_resource_label,
        'resource_url': log.ui_resource_url,
        'time': timezone.localtime(log.created_at).strftime('%d %b %Y, %H:%M:%S'),
        'request_id': log.request_id or '',
        'ip_address': log.ip_address or '',
        'user_agent': log.user_agent or '',
        'path': log.path or '',
        'status_code': log.status_code,
        'description': log.description or '',
        'metadata': log.metadata or {},
    }, default=str)
    return log


def decorate_audit_logs(logs):
    return [decorate_audit_log(log) for log in logs]