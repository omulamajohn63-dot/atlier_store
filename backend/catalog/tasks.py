"""Celery tasks that drive bulk product imports.

The heavy lifting lives in :mod:`catalog.bulk_import` — the very same service
the browser-driven ``/process`` endpoint has always used. This module only owns
the loop, the retry ladder and the failure bookkeeping, so flipping
``CELERY_WORKER_ENABLED`` changes *who* calls the processor, never *what* it
does. That is what keeps all existing import behaviour (upserts, idempotent
``next_index`` skipping, per-product error isolation) identical.
"""

import logging
import random
import uuid

from celery import shared_task
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import InterfaceError, OperationalError
from django.utils import timezone

from audit.services import AuditLogService
from botique_backend.tasks import enqueue_task

logger = logging.getLogger('catalog')

#: Product groups imported per chunk, matching the browser-driven endpoint.
CHUNK_LIMIT = 10

#: Infrastructure faults worth retrying. Data/content problems are not —
#: re-running a job that rejected its own input cannot help.
TRANSIENT_ERRORS = (OperationalError, InterfaceError, TimeoutError,
                    ConnectionError, OSError)

#: 30s / 2m / 10m, plus up to 20% jitter so a broker or DB blip does not make
#: every queued job retry in lockstep.
RETRY_DELAYS = (30, 120, 600)

TERMINAL_STATUSES = (
    'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED',
)


def enqueue_import_job(job_id, actor_id=None):
    """Hand a confirmed import to Celery.

    Runs inline (rather than disappearing into a broker nobody consumes) when
    no worker is configured, and is deferred to ``transaction.on_commit`` when
    one is — so the task can never observe uncommitted state.
    """
    return enqueue_task(
        process_import_job,
        str(job_id),
        str(actor_id) if actor_id else None,
    )


def _resolve_actor(actor_id):
    if not actor_id:
        return None
    try:
        uuid.UUID(str(actor_id))
    except (TypeError, ValueError):
        return None
    return get_user_model().objects.filter(pk=actor_id).first()


def _next_index(job):
    return int((job.import_results or {}).get('next_index', 0))


def _fail_import(job_id, actor, message):
    """Move a PROCESSING job to FAILED, audit it and alert the staff."""
    from admin_ui.models import notify_staff

    from .models import ImportJob

    message = str(message)[:500]
    now = timezone.now()
    existing = ImportJob.objects.filter(pk=job_id).values(
        'filename', 'error_details', 'uploaded_by_id',
    ).first()
    if existing is None:
        return {'status': 'missing'}

    updated = ImportJob.objects.filter(pk=job_id).exclude(
        status__in=TERMINAL_STATUSES,
    ).update(
        status=ImportJob.Status.FAILED,
        completed_at=now,
        processing_token=None,
        processing_lease_until=None,
        error_details={
            **(existing.get('error_details') or {}),
            'errors': [{'level': 'error', 'field': 'import', 'message': message}],
        },
        updated_at=now,
    )
    if not updated:
        # Someone else already finished or cancelled it — leave their verdict.
        return {'status': 'failed', 'superseded': True}

    job = ImportJob.objects.get(pk=job_id)
    AuditLogService.log(
        'bulk_import_failed',
        actor=actor or job.uploaded_by,
        category='catalog',
        object_type='import_job',
        object_id=job.pk,
        object_repr=job.filename,
        description=f'Bulk import failed: {message}',
        metadata={'filename': job.filename, 'error': message},
        result='failure',
    )
    try:
        notify_staff(
            'system',
            'Bulk import failed',
            f'{job.filename}: {message}',
            link=f'/admin/dashboard/products/import/{job.pk}/report/',
            event_key=f'bulk-import-failed:{job.pk}',
            recipient=actor or job.uploaded_by,
            event_type='bulk_import_failed',
            severity='medium',
            resource_type='import_job',
            resource_id=str(job.pk),
            metadata={'error': message},
        )
    except Exception:
        logger.exception('Bulk import failure notification failed for job %s', job.pk)

    from .bulk_import import queue_import_outcome_email

    queue_import_outcome_email(
        'bulk_import_failed', job, 'Bulk import failed.', detail=message)
    return {'status': 'failed', 'error': message}


def _retry_or_fail(task, job_id, actor, exc):
    retries = task.request.retries if task.request else 0
    if retries >= task.max_retries:
        logger.error('Bulk import job %s exhausted retries: %s', job_id, exc)
        return _fail_import(job_id, actor, f'The import could not be continued: {exc}')
    base = RETRY_DELAYS[min(retries, len(RETRY_DELAYS) - 1)]
    countdown = base + random.randint(0, max(1, base // 5))
    logger.warning('Bulk import job %s retry %s/%s in %ss: %s',
                   job_id, retries + 1, task.max_retries, countdown, exc)
    raise task.retry(countdown=countdown, exc=exc)


@shared_task(
    bind=True,
    queue='imports',
    max_retries=3,
    time_limit=2 * 60 * 60,
    soft_time_limit=2 * 60 * 60 - 60,
    acks_late=True,
)
def process_import_job(self, job_id, actor_id=None):
    """Drive an import from PROCESSING to a terminal state.

    Idempotent by construction: the first thing every iteration does is take
    the same lease ``process_chunk`` has always used, so a duplicate message, a
    redelivery after a worker crash or two workers racing all collapse into a
    single execution.
    """
    from .bulk_import import BulkImportError, BulkImportExecutionService
    from .models import ImportJob

    actor = _resolve_actor(actor_id)
    job = ImportJob.objects.filter(pk=job_id).first()
    if job is None:
        return {'status': 'missing'}
    if job.status != ImportJob.Status.PROCESSING:
        # Finished, failed or cancelled before the worker got to it.
        return {'status': job.status}

    while True:
        job = ImportJob.objects.filter(pk=job_id).first()
        if job is None or job.status != ImportJob.Status.PROCESSING:
            return {'status': getattr(job, 'status', 'missing')}

        before = _next_index(job)
        try:
            job, finished = BulkImportExecutionService.process_chunk(
                job.pk, limit=CHUNK_LIMIT, actor=actor)
        except BulkImportError as exc:
            return _fail_import(job_id, actor, exc)
        except ValidationError as exc:
            return _fail_import(job_id, actor, exc)
        except TRANSIENT_ERRORS as exc:
            return _retry_or_fail(self, job_id, actor, exc)
        except Exception as exc:  # noqa: BLE001 - last line of defence
            logger.exception('Bulk import job %s failed unexpectedly', job_id)
            return _fail_import(job_id, actor, exc)

        if finished:
            return {'status': job.status}
        if job.status != ImportJob.Status.PROCESSING:
            # Cancelled while we were working.
            return {'status': job.status}
        if _next_index(job) == before:
            # The lease is held by another execution. Do not spin: whoever holds
            # it is making progress, and requeue_stuck_imports covers a stall.
            logger.warning('Bulk import job %s lease held elsewhere; deferring',
                           job_id)
            return {'status': 'lease-held'}
