"""Re-dispatch emails whose queued message was lost.

Render's free ``Key Value`` add-on is in-memory, so a restart throws away
whatever was sitting in Redis while ``EmailLog`` (Postgres) — the source of
truth — survives. This command rebuilds the work from the log.

Safe to run repeatedly: delivery claims the row atomically and a SENT log is a
no-op, so double-running or racing a live worker cannot duplicate a message.

    python manage.py requeue_stuck_emails --dry-run
    python manage.py requeue_stuck_emails --older-than 600
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from emails.models import EmailLog
from emails.services import requeue_email_log


class Command(BaseCommand):
    help = 'Re-dispatch queued/ retrying emails whose broker message was lost.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--older-than', type=int, default=300, metavar='SECONDS',
            help='Only requeue QUEUED logs that have been waiting at least this '
                 'long (default: 300).')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List what would be requeued without dispatching anything.')

    def handle(self, *args, **options):
        now = timezone.now()
        threshold = now - timedelta(seconds=options['older_than'])

        stuck = EmailLog.objects.filter(
            Q(status=EmailLog.Status.QUEUED, queued_at__lte=threshold)
            | Q(status=EmailLog.Status.RETRYING)
        ).order_by('queued_at')

        if not settings.CELERY_WORKER_ENABLED:
            self.stderr.write(self.style.WARNING(
                'CELERY_WORKER_ENABLED is false: requeued messages will be '
                'delivered inline in this process, not by a worker.'))

        count = 0
        for log in stuck:
            if options['dry_run']:
                self.stdout.write(
                    f'would requeue {log.pk} {log.email_type} -> '
                    f'{log.recipient_email} [{log.status}]')
                count += 1
                continue
            if requeue_email_log(log):
                count += 1

        verb = 'found' if options['dry_run'] else 'requeued'
        self.stdout.write(self.style.SUCCESS(f'{verb} {count} email(s).'))
