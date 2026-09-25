"""``EmailLog`` — the durable record of every outbound message.

Everything the retry ladder, the admin monitoring page and the customer
in-app notification hook need lives here, so a message survives a broker
restart: Redis may forget the queued message, Postgres never forgets the log.
"""

import uuid

from django.conf import settings
from django.db import models

from .constants import EMAIL_TYPE_CHOICES, MAX_ATTEMPTS


class EmailLog(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'QUEUED', 'Queued'
        SENDING = 'SENDING', 'Sending'
        SENT = 'SENT', 'Sent'
        RETRYING = 'RETRYING', 'Retrying'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    #: Statuses that must never be touched again by a delivery attempt.
    TERMINAL_STATUSES = (Status.SENT, Status.FAILED, Status.CANCELLED)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # --- identity --------------------------------------------------------
    # The whole idempotency story: a duplicate business event resolves to the
    # same row, so the second delivery attempt is a no-op at the DB level.
    idempotency_key = models.CharField(max_length=200, unique=True)
    email_type = models.CharField(max_length=64, choices=EMAIL_TYPE_CHOICES)

    # --- addressing ------------------------------------------------------
    recipient_email = models.EmailField()
    recipient_name = models.CharField(max_length=150, blank=True, default='')
    sender_email = models.EmailField(blank=True, default='')

    # --- content ---------------------------------------------------------
    subject = models.CharField(max_length=255)
    body_text = models.TextField(blank=True, default='')
    template_name = models.CharField(max_length=120, blank=True, default='')
    context = models.JSONField(default=dict, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    # --- state machine ---------------------------------------------------
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.QUEUED, db_index=True)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=MAX_ATTEMPTS)

    # --- relations -------------------------------------------------------
    related_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='email_logs')
    related_order = models.ForeignKey(
        'orders.Order', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='email_logs')
    related_payment = models.ForeignKey(
        'payments.PaymentIntent', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='email_logs')
    related_import_job = models.ForeignKey(
        'catalog.ImportJob', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='email_logs')

    # --- timestamps ------------------------------------------------------
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # --- outcome ---------------------------------------------------------
    provider_message_id = models.CharField(max_length=255, blank=True, default='')
    last_error = models.TextField(blank=True, default='')

    class Meta:
        ordering = ('-queued_at',)
        indexes = [
            models.Index(fields=('status', 'next_retry_at')),
            models.Index(fields=('email_type', '-queued_at')),
            models.Index(fields=('-queued_at',)),
        ]
        constraints = [
            models.UniqueConstraint(fields=('idempotency_key',), name='uniq_emaillog_key'),
        ]

    def __str__(self):
        return f'{self.email_type} → {self.recipient_email} [{self.status}]'

    @property
    def can_retry(self):
        """Only a terminal failure is worth an admin-triggered resend."""
        return self.status == self.Status.FAILED

    @property
    def is_delivered(self):
        return self.status == self.Status.SENT
