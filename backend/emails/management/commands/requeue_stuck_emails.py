"""Re-dispatch emails whose queued message was lost or never started.

Three ways a row can be waiting for delivery, and all three land here:

* ``EMAIL_DELIVERY_MODE=deferred`` — the normal production mode: web requests
  never open a socket for mail, so this (or the sweeper endpoint) is what
  actually sends.
* A lost broker message — Render's free ``Key Value`` add-on is in-memory, so
  a restart throws away whatever was sitting in Redis while ``EmailLog``
  (Postgres, the source of truth) survives.
* A temporary failure whose backoff has elapsed.

Safe to run repeatedly: delivery claims the row atomically, a SENT log is a
no-op, and a RETRYING row is skipped until ``next_retry_at`` — so
double-running or racing a live sweeper cannot duplicate a message.

    python manage.py requeue_stuck_emails --dry-run
    python manage.py requeue_stuck_emails --older-than 600
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from emails.services import email_enabled, pending_for_sweep, sweep_pending_emails


class Command(BaseCommand):
    help = 'Deliver queued / retrying emails whose dispatch was lost.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--older-than', type=int, default=45, metavar='SECONDS',
            help='Only sweep QUEUED logs that have been waiting at least this '
                 'long (default: 45, so a row is picked up on the next tick).')
        parser.add_argument(
            '--limit', type=int, default=10, metavar='N',
            help='Maximum messages to attempt this run (default: 10).')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List what would be delivered without attempting anything.')

    def handle(self, *args, **options):
        older_than = options['older_than']
        limit = options['limit']

        if options['dry_run']:
            pending = pending_for_sweep(older_than=older_than, limit=limit)
            for log in pending:
                self.stdout.write(
                    f'would deliver {log.pk} {log.email_type} -> '
                    f'{log.recipient_email} [{log.status}]')
            self.stdout.write(self.style.SUCCESS(
                f'found {len(pending)} email(s).'))
            return

        if not settings.CELERY_WORKER_ENABLED:
            self.stderr.write(self.style.WARNING(
                'CELERY_WORKER_ENABLED is false: messages are delivered by '
                'this process, not by a worker.'))

        summary = sweep_pending_emails(older_than=older_than, limit=limit)
        self.stdout.write(self.style.SUCCESS(
            'found {found} email(s): {requeued} delivered, {failed} failed, '
            '{skipped} not due.'.format(**summary)))
        if summary['failed']:
            self.stderr.write(self.style.WARNING(
                'Failures are recorded on EmailLog.last_error; inspect them '
                'at /admin/dashboard/emails/ or re-run with --dry-run.'))
