# CELERY.md — Background Imports & the Email Subsystem

Two kinds of work do not belong inside an HTTP request:

* **bulk product imports** — thousands of spreadsheet rows, image writes and
  stock mutations, capped at two hours;
* **outbound email** — an SMTP round trip per message, with a retry ladder.

Both now run through Celery. This document is the operational runbook: what
the switches do, how to run it locally, what Render needs, and how to recover
after a restart.

---

## The switches

Everything is governed by three environment variables read in
`botique_backend/settings.py`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `REDIS_URL` | *(empty)* | Broker. Render injects it automatically when a Redis resource is linked. |
| `CELERY_WORKER_ENABLED` | `true` **iff** `REDIS_URL` is set | The single switch. `false` → the browser-driven `/process` import loop and inline, after-commit email delivery. `true` → both handed to a worker. |
| `CELERY_TASK_ALWAYS_EAGER` | `true` unless a worker is enabled **and** reachable | Safety net: if `.delay()` is ever called with no worker able to drain the broker, the task runs inline instead of being stranded. |

Under the test runner (`manage.py test`) all three are forced to
`memory://` / `EAGER` / `WORKER_ENABLED=False`, and `EMAIL_BACKEND` is forced
to the locmem backend so `django.core.mail.outbox` is available to every test
and no test can open a socket.

> **Render must ship `CELERY_WORKER_ENABLED: "false"` explicitly.** Leaving it
> unset on a service that *does* have `REDIS_URL` would default it to `true`
> and route work to a worker that does not exist.

---

## Queues

`CELERY_TASK_ROUTES` in `settings.py`:

| Queue | Consumes | Tasks |
| --- | --- | --- |
| `imports` | `catalog.tasks.*` | `enqueue_import_job`, `process_import_job` |
| `email` | `emails.tasks.*` | `send_email_log` |
| `default` | everything else, including the smoke test | `botique_backend.ping` |

A single worker process consumes all three:

```bash
celery -A botique_backend worker --loglevel=info --queues=default,imports,email --concurrency=2
```

### Task catalogue

| Task | Queue | Time limit | Notes |
| --- | --- | --- | --- |
| `catalog.tasks.process_import_job` | `imports` | **2 h** (task-level override of `CELERY_TASK_TIME_LIMIT`) | Drives `BulkImportExecutionService.process_chunk` in a loop; cooperative stop at product-group boundaries when the job is cancelled. Retries 3× at 30 s / 2 m / 10 m. |
| `emails.tasks.send_email_log` | `email` | 600 s | One delivery attempt; re-dispatches itself with a `countdown` for the next rung of the ladder. |
| `botique_backend.ping` | `default` | — | Smoke test: `celery -A botique_backend call botique_backend.ping`. |

---

## Delivery guarantees

**Imports.** `process_import_job` is idempotent. It re-reads the job row, and
returns immediately if the job is already `COMPLETED`, `FAILED` or
`CANCELLED`. Rows that were already imported are skipped by the `next_index`
cursor, so a redelivered task cannot double-create a product. The completion
or failure email is keyed on the job (`bulk_import_completed:import:<pk>`),
so a second delivery cannot email the operator twice.

**Email.** `EmailLog` (Postgres) owns retry state, not Celery. Render's free
Redis key value is in-memory, so a restart can lose the queued *message*; the
log survives and `requeue_stuck_emails` re-derives the work from it.

* `queue_email` de-duplicates on `idempotency_key` — a duplicated webhook,
  callback or re-entrant service call resolves to the same row and sends once.
* Delivery claims the row with an atomic
  `QUEUED/RETRYING -> SENDING` update, so a duplicate broker message, a
  worker-crash redelivery and an admin retry can never send concurrently.
* Everything is dispatched on `transaction.on_commit`, so a rolled-back order
  never produces an email and a worker never reads uncommitted state.

### Retry ladders

**Email** — `emails/constants.py`, 5 attempts total, ±20 % jitter:

| Attempt | Delay before next |
| --- | --- |
| 1 | 30 s |
| 2 | 2 m |
| 3 | 10 m |
| 4 | 30 m |
| 5 | `FAILED` |

Failure classification is authoritative on the SMTP status code: `4xx` →
temporary (retry), `5xx` → permanent (stop now). Known permanent exception
types (`BadHeaderError`, `ValidationError`, …) win next; anything else is
treated as temporary because the ladder is bounded anyway. Only **terminal**
failures raise a staff notification — one bell entry per failed message, not
one per attempt.

**Imports** — 3 attempts at 30 s / 2 m / 10 m, then the job is marked
`FAILED` and the operator is emailed once.

---

## Local development

Three modes, all exercised by the test suite:

```bash
# 1. No Redis, no worker — the default. Everything runs inline.
python manage.py runserver

# 2. Real worker. Start Redis, then:
REDIS_URL=redis://localhost:6379/0 CELERY_WORKER_ENABLED=true python manage.py runserver
celery -A botique_backend worker --loglevel=info --queues=default,imports,email

# 3. Tests — forced eager, forced locmem mailbox.
python manage.py test emails
python manage.py test catalog
```

Sanity check the broker/worker link:

```bash
celery -A botique_backend call botique_backend.ping
# -> {'ok': True, 'pong': 'pong'}
```

---

## Render

### Shipped configuration (web only)

`render.yaml` runs a single Docker web service with:

```yaml
- key: CELERY_WORKER_ENABLED
  value: "false"
```

There is no worker, so bulk imports run in the request that confirms them
(driving the same `process_chunk` loop, with the progress page polling as
before) and every email is delivered inline immediately after the DB commit.
**Every behaviour is identical** — retries, idempotency, audit rows, the
`/admin/dashboard/emails/` pages — only the process performing the send
differs.

### Enabling the worker

Render's free tier rejects `type: worker` with `plan: free`, so the worker
block ships **commented out** at the bottom of `render.yaml`. To turn it on:

1. Upgrade to a paid plan — a worker costs the price of one Starter instance.
2. Uncomment the `type: worker` block in `render.yaml`.
3. Set `CELERY_WORKER_ENABLED: "true"` on the **web** service as well, so it
   starts publishing to Redis instead of running inline.
4. Point the worker's `REDIS_URL` at the same Redis resource the web service
   uses (`fromService: type: redis`), and copy across the remaining env vars —
   the worker imports Django models, templates and settings.

Both services must share one `REDIS_URL`; two different brokers means the web
service queues work nobody consumes.

### Required env vars

| Name | Where | Notes |
| --- | --- | --- |
| `REDIS_URL` | injected by Render when Redis is linked | Do **not** declare it manually in `render.yaml`. |
| `CELERY_WORKER_ENABLED` | web service | `"false"` while there is no worker. |
| `CELERY_VISIBILITY_TIMEOUT` | both, optional | Default `7500` s. Must exceed the 2 h import limit or Redis redelivers a running job to a second worker. |
| `CELERY_TASK_TIME_LIMIT` | worker, optional | Default `3600` s — the *fallback* limit. `process_import_job` overrides it to 2 h and `send_email_log` to 600 s. |
| `SERVER_EMAIL` | web service | Where admin alerts (failed imports, critical errors) land. Defaults to `DEFAULT_FROM_EMAIL`. |
| `STORE_EMAIL` | web service | `hello@modeza.co.ke` — the single ops inbox every admin email type is addressed to. |

---

## Recovering after a restart

Render's free Redis is in-memory. A restart drops queued messages; the
database rows survive. Two management commands rebuild the work:

```bash
# Bulk imports that were mid-flight when the process died.
python manage.py requeue_stuck_imports --dry-run
python manage.py requeue_stuck_imports --older-than 600

# Emails stuck in QUEUED (or RETRYING whose next_retry_at has passed).
python manage.py requeue_stuck_emails --dry-run
python manage.py requeue_stuck_emails --older-than 300
```

`--dry-run` lists what would be requeued without dispatching anything.
`--older-than` is in seconds and only considers rows that have been waiting at
least that long, so a restart does not fight in-flight work.

Neither command is needed when a worker is healthy — it is a **post-restart**
ritual for the free-tier setup. Consider scheduling them (or just the
`--dry-run` variant, to page you) from a Render cron job.

---

## Limitations / next phase

* **No worker on the free plan.** Long imports occupy a web worker for their
  duration; on a single-instance free service that can block other requests.
  Moving the import loop onto a paid worker is the single biggest win.
* **No scheduled retries.** The email ladder is driven by a `countdown`
  message in worker mode and by the next inline dispatch otherwise; there is
  no periodic beat process. Add `celery -A botique_backend beat` if you later
  want time-based housekeeping (retention pruning, stuck-row sweeps).
* **No fan-out for admin alerts.** Every admin email type goes to the single
  `STORE_EMAIL` inbox; the in-app `notify_staff` channel is what fans out to
  individual staff accounts.
* **`EmailLog.attachments` stores storage keys, not base64.** A log whose
  attachment file has been pruned from storage sends without it (the failure
  is logged, not fatal).
* **No dead-letter queue.** Terminal failures are visible on
  `/admin/dashboard/emails/?status=failed` and as a staff notification;
  re-sending is an explicit staff action.
