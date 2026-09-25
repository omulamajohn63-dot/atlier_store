from django.contrib import admin

from .models import EmailLog


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ('email_type', 'recipient_email', 'subject', 'status',
                    'attempt_count', 'queued_at', 'sent_at', 'failed_at')
    list_filter = ('status', 'email_type')
    search_fields = ('recipient_email', 'subject', 'idempotency_key', 'last_error')
    readonly_fields = [field.name for field in EmailLog._meta.fields]
    ordering = ('-queued_at',)

    def has_add_permission(self, request):
        # Logs are created only by the application, never by hand.
        return False
