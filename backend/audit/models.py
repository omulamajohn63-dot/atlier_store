import uuid

from django.conf import settings
from django.db import models

from .constants import AUDIT_ACTIONS


class AuditLog(models.Model):
    """One immutable entry in the centralized application audit trail.

    All writes go through :class:`audit.services.AuditLogService`, which
    sanitizes metadata, attaches request correlation and never raises so a
    failing audit write cannot break the caller's transaction.
    """

    class Result(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"

    class Severity(models.TextChoices):
        INFO = "info", "Info"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        db_index=True,
    )
    actor_role = models.CharField(max_length=20, blank=True, default="")
    actor_email = models.CharField(max_length=254, blank=True, default="")
    action = models.CharField(
        max_length=32,
        choices=[(action, action.replace("_", " ").title())
                 for action in AUDIT_ACTIONS],
        db_index=True,
    )
    category = models.CharField(
        max_length=20, blank=True, default="", db_index=True)
    object_type = models.CharField(max_length=40, blank=True, default="")
    object_id = models.CharField(max_length=100, blank=True, default="")
    object_repr = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    result = models.CharField(
        max_length=10,
        choices=Result.choices,
        default=Result.SUCCESS,
        db_index=True,
    )
    severity = models.CharField(
        max_length=10,
        choices=Severity.choices,
        default=Severity.INFO,
        db_index=True,
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    request_id = models.CharField(max_length=80, blank=True, default="", db_index=True)
    path = models.CharField(max_length=255, blank=True, default="")
    status_code = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("object_type", "object_id")),
            models.Index(fields=("action", "created_at")),
            models.Index(fields=("created_at", "severity")),
        ]

    def __str__(self):
        return f"{self.action} {self.object_repr or self.object_type or 'record'} ({self.result})"