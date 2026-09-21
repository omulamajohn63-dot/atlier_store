from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only Django admin for the audit trail.

    Audits are written exclusively by AuditLogService. Creation and mutation
    from the admin are disabled so the trail stays append-only.
    """

    list_display = (
        "created_at",
        "action",
        "category",
        "object_repr",
        "actor",
        "result",
        "severity",
        "request_id",
    )
    list_filter = ("action", "category", "result", "severity", "created_at")
    search_fields = (
        "request_id",
        "object_repr",
        "object_id",
        "actor__username",
        "actor__email",
        "description",
    )
    date_hierarchy = "created_at"
    readonly_fields = [
        "actor",
        "actor_role",
        "actor_email",
        "action",
        "category",
        "object_type",
        "object_id",
        "object_repr",
        "description",
        "metadata",
        "result",
        "severity",
        "ip_address",
        "user_agent",
        "request_id",
        "path",
        "status_code",
        "created_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser