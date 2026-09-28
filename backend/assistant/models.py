"""Server-side conversation state for the Modeza AI shopping assistant.

Conversations are customer data: they carry message content, so every access
path must be ownership-checked (see ``assistant.views._authorize``) and old
rows are purged by ``manage.py purge_assistant_conversations``.
"""
import uuid

from django.conf import settings
from django.db import models


class AssistantConversation(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active'
        ENDED = 'ended'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.CASCADE, related_name='assistant_conversations')
    # Opaque token identifying a guest's conversation (never guessable).
    session_key = models.CharField(max_length=64, blank=True, default='',
                                   db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices,
                              default=Status.ACTIVE, db_index=True)
    # Gemini Interactions API id used for stateful multi-turn chaining.
    last_interaction_id = models.CharField(max_length=120, blank=True,
                                           default='')
    message_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)
        indexes = [
            models.Index(fields=('user', '-created_at')),
            models.Index(fields=('status', '-updated_at')),
        ]

    def __str__(self):
        owner = f'user:{self.user_id}' if self.user_id else 'guest'
        return f'{self.pk} ({owner})'


class AssistantMessage(models.Model):
    class Role(models.TextChoices):
        USER = 'user'
        ASSISTANT = 'assistant'

    class Kind(models.TextChoices):
        REPLY = 'reply'
        ERROR = 'error'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        AssistantConversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=Role.choices)
    kind = models.CharField(max_length=10, choices=Kind.choices,
                            default=Kind.REPLY)
    content = models.TextField(blank=True, default='')
    # Product references validated server-side (slugs of real, visible items).
    product_refs = models.JSONField(default=list, blank=True)
    # Server-approved storefront actions (e.g. add_to_cart), never raw model
    # output — see assistant.services.actions.
    actions = models.JSONField(default=list, blank=True)
    unanswered = models.BooleanField(default=False, db_index=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    usage = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ('created_at',)
        indexes = [
            models.Index(fields=('conversation', 'created_at')),
            models.Index(fields=('created_at',)),
        ]

    def __str__(self):
        return f'{self.role}: {self.content[:40]}'


class AssistantToolCall(models.Model):
    class Status(models.TextChoices):
        OK = 'ok'
        ERROR = 'error'
        TIMEOUT = 'timeout'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        AssistantConversation, on_delete=models.CASCADE,
        related_name='tool_calls')
    message = models.ForeignKey(
        AssistantMessage, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='tool_calls')
    tool_name = models.CharField(max_length=64, db_index=True)
    # Sanitized/truncated arguments — never raw customer message content.
    arguments = models.JSONField(default=dict, blank=True)
    result_summary = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices,
                              default=Status.OK, db_index=True)
    error_code = models.CharField(max_length=40, blank=True, default='')
    duration_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ('created_at',)
        indexes = [
            models.Index(fields=('conversation', 'created_at')),
            models.Index(fields=('tool_name', 'created_at')),
            models.Index(fields=('status', 'created_at')),
        ]

    def __str__(self):
        return f'{self.tool_name} ({self.status})'


class AssistantInsight(models.Model):
    """Aggregated signal for the admin Assistant Analytics page.

    Holds only short, customer-supplied question fragments (truncated) or
    operational event names — no full conversation content.
    """

    class Kind(models.TextChoices):
        UNANSWERED = 'unanswered'
        ZERO_RESULT = 'zero_result'
        ESCALATION = 'escalation'
        GEMINI_ERROR = 'gemini_error'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=Kind.choices, db_index=True)
    text = models.CharField(max_length=500)
    normalized = models.CharField(max_length=500, db_index=True)
    count = models.PositiveIntegerField(default=1)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ('-last_seen',)
        constraints = [
            models.UniqueConstraint(fields=('kind', 'normalized'),
                                    name='unique_assistant_insight'),
        ]
        indexes = [
            models.Index(fields=('kind', '-last_seen')),
        ]

    def __str__(self):
        return f'{self.kind}: {self.text[:60]}'
