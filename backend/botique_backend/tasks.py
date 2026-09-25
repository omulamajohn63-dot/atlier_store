"""Dispatch helpers shared by every app that queues Celery work.

``enqueue_task`` is the single place that decides *when* background work leaves
a request:

* with a worker configured -> defer to ``transaction.on_commit`` so the task can
  never observe uncommitted state (and never runs for a rollback);
* without a worker -> run the task inline so the work still happens instead of
  silently disappearing into a broker nobody consumes.
"""

from django.conf import settings
from django.db import transaction


def enqueue_task(task, *args, **kwargs):
    """Hand ``task`` to Celery, safe to call from inside a transaction.

    Returns the task result when executed inline, otherwise the id returned by
    ``transaction.on_commit`` (which is ``None`` until the transaction commits).
    Callers must not depend on the return value.
    """
    if not getattr(settings, 'CELERY_WORKER_ENABLED', False):
        return task.apply(args=args, kwargs=kwargs)

    if transaction.get_connection().in_atomic_block:
        return transaction.on_commit(lambda: task.delay(*args, **kwargs))
    return task.delay(*args, **kwargs)
