from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from audit.models import AuditLog


class Command(BaseCommand):
    help = (
        "Delete audit log entries older than AUDIT_LOG_RETENTION_DAYS "
        "(default 365). Also expires reservations if it did not happen."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            required=False,
            help="Retention window in days; overrides AUDIT_LOG_RETENTION_DAYS.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print how many records would be deleted without deleting.",
        )

    def handle(self, *args, **options):
        days = options["days"] or int(
            getattr(settings, "AUDIT_LOG_RETENTION_DAYS", 365))
        if days < 0:
            self.stderr.write("Retention days cannot be negative.")
            return

        cutoff = timezone.now() - timedelta(days=days)
        queryset = AuditLog.objects.filter(created_at__lt=cutoff)
        total = queryset.count()

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: {total} audit log entries older than "
                    f"{days} days would be deleted."))
            return

        if total:
            deleted, _ = queryset.delete()
        else:
            deleted = 0
        self.stdout.write(self.style.SUCCESS(
            f"Deleted {deleted} audit log entries older than {days} days."))