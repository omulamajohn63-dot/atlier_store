"""Re-enqueue bulk imports that are stuck in PROCESSING.

A Celery worker crash (Render restarts free services) or a lost broker message
can leave an import mid-flight with nobody driving it. Postgres still holds the
job, the lease and ``next_index``, so the work is recoverable.

The lease guard makes this safe: ``process_chunk`` refuses to start while a
lease is live, so re-enqueueing a job another worker is actively running simply
exits without touching it.

    python manage.py requeue_stuck_imports --dry-run
    python manage.py requeue_stuck_imports --older-than 3600
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from catalog.models import ImportJob
from catalog.tasks import enqueue_import_job


class Command(BaseCommand):
    help = 'Re-enqueue bulk imports stuck in PROCESSING with an expired lease.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--older-than', type=int, default=600, metavar='SECONDS',
            help='Only requeue jobs whose lease expired at least this long ago '
                 '(default: 600).')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List stuck jobs without enqueueing them.')

    def handle(self, *args, **options):
        now = timezone.now()
        threshold = now - timedelta(seconds=options['older_than'])

        stuck = ImportJob.objects.filter(
            status=ImportJob.Status.PROCESSING,
        ).filter(
            Q(processing_lease_until__isnull=True)
            | Q(processing_lease_until__lte=threshold),
        ).order_by('created_at')

        if not settings.CELERY_WORKER_ENABLED:
            self.stderr.write(self.style.WARNING(
                'CELERY_WORKER_ENABLED is false: there is no worker to consume '
                'these jobs. They will run inline in this process, which may '
                'take a long time for a large import.'))

        count = 0
        for job in stuck:
            if options['dry_run']:
                self.stdout.write(
                    f'would requeue {job.pk} {job.filename} at '
                    f'row {job.processed_rows}/{job.total_rows}')
                count += 1
                continue
            enqueue_import_job(job.pk, job.uploaded_by_id)
            count += 1
            self.stdout.write(f'requeued {job.pk} {job.filename}')

        verb = 'found' if options['dry_run'] else 'requeued'
        self.stdout.write(self.style.SUCCESS(f'{verb} {count} import job(s).'))
