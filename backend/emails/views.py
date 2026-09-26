"""Staff pages for the outbound email log: inspect, retry, bulk retry.

The list page is the operational surface for the whole subsystem: it answers
"what is queued, what is retrying, what died?" without anyone having to read a
server log. Retries are deliberately an explicit staff action — the automatic
ladder already owns the transient cases, so a manual retry means "I fixed the
SMTP config, send it now".
"""

from urllib.parse import urlencode

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import redirect, render
from django.views import View

from access_control.services import permission_required
from admin_ui.views import StaffRequiredMixin
from audit.services import AuditLogService

from .constants import EMAIL_TYPE_CHOICES
from .models import EmailLog
from .services import email_enabled, requeue_email_log, retry_email_log

PAGE_SIZE = 25

#: Badge colour per status, mapped onto the shared ``status-badge`` palette
#: defined in ``base_admin.html``.
STATUS_CLASS = {
    'SENT': 'status-success',
    'QUEUED': 'status-neutral',
    'SENDING': 'status-processing',
    'RETRYING': 'status-warning',
    'FAILED': 'status-failed',
    'CANCELLED': 'status-neutral',
}

TYPE_LABELS = dict(EMAIL_TYPE_CHOICES)
STATUS_LABELS = dict(EmailLog.Status.choices)

#: Optional actions offered by the list page: ``''`` means "everything".
FILTERABLE_STATUSES = ('FAILED', 'RETRYING', 'QUEUED', 'SENT')


def _decorate(log):
    log.status_class = STATUS_CLASS.get(log.status, 'status-neutral')
    log.status_label = STATUS_LABELS.get(log.status, log.status)
    log.type_label = TYPE_LABELS.get(log.email_type, log.email_type)
    log.can_resend = log.status in (
        EmailLog.Status.FAILED, EmailLog.Status.QUEUED, EmailLog.Status.RETRYING)
    return log


def _resend(log):
    """Re-send whatever this row currently allows. Returns ``(log, dispatched)``."""
    if log.status == EmailLog.Status.FAILED:
        return retry_email_log(log)
    return log, requeue_email_log(log)


def _filters(request):
    return {
        'status': (request.GET.get('status') or '').strip().upper(),
        'email_type': (request.GET.get('type') or '').strip(),
        'q': (request.GET.get('q') or '').strip(),
    }


def _page_base(filters):
    """Query-string prefix (trailing ``&``) that keeps the active filters while
    paginating; empty when nothing is filtered."""
    active = {key: value for key, value in filters.items() if value}
    if not active:
        return ''
    return '?' + urlencode(active) + '&'


def _apply_filters(queryset, filters):
    if filters['status']:
        queryset = queryset.filter(status=filters['status'])
    if filters['email_type']:
        queryset = queryset.filter(email_type=filters['email_type'])
    if filters['q']:
        term = filters['q']
        queryset = queryset.filter(
            Q(subject__icontains=term)
            | Q(recipient_email__icontains=term)
            | Q(idempotency_key__icontains=term)
            | Q(last_error__icontains=term)
        )
    return queryset


def _audit(log, actor, dispatched):
    AuditLogService.log(
        'email_retry_requested',
        actor=actor,
        category='system',
        object_type='email_log',
        object_id=log.pk,
        object_repr=log.subject,
        result='success' if dispatched else 'failure',
        metadata={
            'email_type': log.email_type,
            'recipient': log.recipient_email,
            'previous_status': log.status,
            'dispatched': dispatched,
        },
        description=f'Re-send requested for email to {log.recipient_email}.',
    )


@permission_required('emails.view')
class EmailLogListView(StaffRequiredMixin, View):
    """Every outbound message, newest first, with status/type/text filters."""

    template_name = 'emails/email_log_list.html'

    def get(self, request):
        filters = _filters(request)
        queryset = _apply_filters(
            EmailLog.objects.order_by('-queued_at'), filters)

        page_obj = Paginator(queryset, PAGE_SIZE).get_page(
            request.GET.get('page', '1'))
        logs = [_decorate(log) for log in page_obj.object_list]

        counts = {
            status: EmailLog.objects.filter(status=status).count()
            for status in FILTERABLE_STATUSES
        }

        return render(request, self.template_name, {
            'email_logs': logs,
            'page_obj': page_obj,
            'filters': filters,
            'page_base': _page_base(filters),
            'counts': counts,
            'status_options': [
                (value, STATUS_LABELS[value]) for value in FILTERABLE_STATUSES],
            'type_options': [
                (value, label) for value, label in EMAIL_TYPE_CHOICES],
            'page_title': 'Emails',
            'page_subtitle': 'Outbound transactional email: queued, sent, '
                             'retrying and failed.',
            'email_enabled': email_enabled(),
            'admin_page': 'emails',
            'title': 'Emails',
            'description': 'Outbound transactional email log.',
            'data_loaded': True,
        })


@permission_required('emails.view')
class EmailLogDetailView(StaffRequiredMixin, View):
    """One message: full body, addressing, attempts and the last error."""

    template_name = 'emails/email_log_detail.html'

    def get(self, request, log_id):
        log = EmailLog.objects.filter(pk=log_id).first()
        if log is None:
            messages.error(request, 'Email not found.')
            return redirect('emails:admin-email-list')
        return render(request, self.template_name, {
            'log': _decorate(log),
            'type_label': TYPE_LABELS.get(log.email_type, log.email_type),
            'related_order': log.related_order,
            'related_user': log.related_user,
            'related_import_job': log.related_import_job,
            'page_title': 'Email detail',
            'page_subtitle': log.subject,
            'email_enabled': email_enabled(),
            'admin_page': 'emails',
            'title': 'Email detail',
            'description': log.subject,
            'data_loaded': True,
        })


@permission_required('emails.manage')
class EmailLogRetryView(StaffRequiredMixin, View):
    """Put a single message back on the wire."""

    def get(self, request, log_id):
        return self._handle(request, log_id)

    def post(self, request, log_id):
        return self._handle(request, log_id)

    def _handle(self, request, log_id):
        log = EmailLog.objects.filter(pk=log_id).first()
        if log is None:
            messages.error(request, 'Email not found.')
            return redirect('emails:admin-email-list')
        log, dispatched = _resend(log)
        _audit(log, request.user, dispatched)
        if dispatched:
            messages.success(
                request, f'Email to {log.recipient_email} queued for re-send.')
        elif not email_enabled():
            messages.error(
                request,
                'Email delivery is deactivated (EMAIL_ENABLED=false); '
                'nothing was sent.')
        else:
            messages.error(
                request,
                f'Email to {log.recipient_email} is not re-sendable '
                f'(status: {log.status}).')
        return redirect('emails:admin-email-detail', log_id=log.pk)


@permission_required('emails.manage')
class EmailLogBulkRetryView(StaffRequiredMixin, View):
    """Re-send every selected message in one action."""

    def post(self, request):
        ids = request.POST.getlist('ids')
        if not ids:
            messages.error(request, 'No emails selected.')
            return redirect('emails:admin-email-list')
        if not email_enabled():
            messages.error(
                request,
                'Email delivery is deactivated (EMAIL_ENABLED=false); '
                'nothing was sent.')
            return redirect('emails:admin-email-list')

        dispatched = 0
        skipped = 0
        for log in EmailLog.objects.filter(pk__in=ids):
            log, ok = _resend(log)
            _audit(log, request.user, ok)
            if ok:
                dispatched += 1
            else:
                skipped += 1

        if dispatched:
            messages.success(
                request, f'{dispatched} email(s) queued for re-send.')
        if skipped:
            messages.error(
                request, f'{skipped} email(s) could not be re-sent.')
        return redirect('emails:admin-email-list')
