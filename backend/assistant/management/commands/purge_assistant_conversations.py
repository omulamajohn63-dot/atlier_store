"""Purge assistant conversations past the retention window.

Run daily (cron/Render scheduler):

    python manage.py purge_assistant_conversations
    python manage.py purge_assistant_conversations --older-than 30

Retention defaults to ``ASSISTANT_RETENTION_DAYS`` (90) in settings.
Messages and tool calls cascade with their conversation; insights are
aggregates and are kept.
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from assistant.models import AssistantConversation


class Command(BaseCommand):
    help = 'Delete assistant conversations older than the retention window.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--older-than', type=int, default=None,
            help='Override ASSISTANT_RETENTION_DAYS with a day count.')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Report how many would be deleted without deleting.')

    def handle(self, *args, **options):
        days = options.get('older_than')
        if days is None:
            days = int(getattr(settings, 'ASSISTANT_RETENTION_DAYS', 90))
        days = max(int(days), 1)
        cutoff = timezone.now() - timedelta(days=days)
        stale = AssistantConversation.objects.filter(updated_at__lt=cutoff)
        count = stale.count()
        if options['dry_run']:
            self.stdout.write(
                f'{count} conversation(s) older than {days} day(s) would be '
                'deleted.')
            return
        deleted, _ = stale.delete()
        self.stdout.write(self.style.SUCCESS(
            f'Deleted {deleted} record(s) from conversations older than '
            f'{days} day(s).'))
