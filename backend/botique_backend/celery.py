"""Celery application for MODEZA.

Imported by ``botique_backend/__init__`` so that ``celery -A botique_backend``
and Django share a single app instance. Settings are read from Django's
``CELERY_*`` namespace (see ``botique_backend/settings.py``); tasks are
auto-discovered from ``tasks.py`` modules in every installed app.
"""

import logging
import os

from celery import Celery
from celery.signals import task_failure, task_postrun, task_prerun, task_retry

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'botique_backend.settings')

app = Celery('botique_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

logger = logging.getLogger('modeza.celery')


@app.task(name='botique_backend.ping', queue='default')
def ping(value='pong'):
    """Broker/worker smoke test.

    ``celery -A botique_backend call botique_backend.ping`` from the Render
    shell (or locally) returns ``{'pong': 'pong', 'ok': True}``.
    """
    return {'pong': value, 'ok': True}


# ---------------------------------------------------------------------------
# Observability. Part 37 asks for structured per-task logs rather than bespoke
# monitoring infrastructure: task id, name, queue and duration are enough to
# answer "is anything running / how long is it taking / did it blow up".
# ---------------------------------------------------------------------------
@task_prerun.connect
def _task_prerun(task_id=None, task=None, **kwargs):
    request = getattr(task, 'request', None)
    delivery = getattr(request, 'delivery_info', None) or {}
    logger.info('task started id=%s task=%s queue=%s',
                task_id, getattr(task, 'name', ''), delivery.get('routing_key', ''))


@task_postrun.connect
def _task_postrun(task_id=None, task=None, state=None, **kwargs):
    runtime = kwargs.get('runtime')
    logger.info('task finished id=%s task=%s state=%s runtime=%s',
                task_id, getattr(task, 'name', ''), state,
                f'{runtime:.2f}s' if runtime else 'n/a')


@task_retry.connect
def _task_retry(task_id=None, reason=None, **kwargs):
    logger.warning('task retrying id=%s reason=%s', task_id, reason)


@task_failure.connect
def _task_failure(task_id=None, exception=None, sender=None, traceback=None, **kwargs):
    logger.error('task failed id=%s task=%s error=%s',
                 task_id, getattr(sender, 'name', ''), exception, exc_info=exception)
