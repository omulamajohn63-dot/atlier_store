# MODEZA Boutique — Commerce Storefront

Full-stack fashion boutique: **Django** REST API + admin (deployed to **Render**)
backed by **Postgres**, and a **React/Vite** storefront (deployed to **Vercel** as a
static SPA). Supabase provides membership/auth + database for your external IDs.

```
Browser ──▶ Vercel (Vite SPA, /assets)
              │  VITE_API_BASE_URL ──▶ Render (Django /api/*)
              │  VITE_SUPABASE_URL ──▶ Supabase (auth, account data)
              └  MPesa callback ─────▶ Render /api/payments/mpesa/callback
```

## Local development

**Backend (Django, port 8000)**
```bash
cd backend
python -m venv ../.venv
# activate venv, then:
pip install -r requirements.txt
cp .env.example .env          # fill in Supabase / payment keys
python manage.py migrate
python manage.py runserver    # http://127.0.0.1:8000
```

**Frontend (Vite + Express dev server, port 3000)**
```bash
cd frontend
npm install
cp .env.example .env.local    # VITE_API_BASE_URL=http://127.0.0.1:8000, VITE_ADMIN_URL=...
npm run dev                   # http://localhost:3000
npm run lint && npm run build # typecheck + production build
npm run test:api              # bundled API integration tests
```

## Deploy the backend to Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo (or *New → Web Service → Docker*,
   root directory `backend`). A `render.yaml` blueprint is included and deploys the
   `backend/Dockerfile` automatically.
3. Set environment variables in the dashboard (see `.env.example`):
   - `DJANGO_SECRET_KEY`, `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWT_ISSUER`,
     `PAYMENT_WEBHOOK_SECRET`, `MPESA_CALLBACK_SECRET`, MPesa Daraja creds, `MPESA_CALLBACK_URL`.
   - `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS=<app.onrender.com>`,
     `DJANGO_SECURE_SSL_REDIRECT=True`, `FRONTEND_ORIGIN=<vercel-url>`.
   - Observability: `LOG_FORMAT=json`, `LOG_LEVEL=INFO`,
     `AUDIT_LOG_RETENTION_DAYS=365`, `USE_X_FORWARDED_FOR=True`, and an optional
     `THROTTLE_AUDIT_RATE` for the client audit-event endpoint.
   - Background work: `CELERY_WORKER_ENABLED=false` (the free plan cannot run a
      worker, so bulk imports run inline in the web process) and
      `EMAIL_DELIVERY_MODE=deferred` (email does **not** run inline — see below).
      Link a managed **Redis** resource to get `REDIS_URL` injected — see
      `backend/docs/CELERY.md` for how to switch the worker on later.
   - Outbound email: **currently deactivated** — `EMAIL_ENABLED=false` (the
      blueprint default). The mailer is still installed and still records
      every message in `/admin/dashboard/emails/`, but nothing is sent and
      nothing reaches `SENT`. It is off because there is no custom domain yet
      for Resend to verify. To switch it on: register a domain, verify it at
      resend.com, set `RESEND_API_KEY` + `EMAIL_ENABLED=true`, and point
      `DEFAULT_FROM_EMAIL` / `SERVER_EMAIL` at that domain. Remember
      Render's free plan blocks outbound SMTP (ports 25/465/587), so mail
      leaves through the Resend HTTPS API on port 443.
   - Add a managed **Postgres** database and paste its connection string into `DATABASE_URL`.
4. Migrations now run automatically on every container start (`python manage.py migrate
   --noinput` in the Dockerfile), so the schema is applied as soon as the first deploy
   boots. To apply them manually (e.g. for a one-off):

   ```bash
   DATABASE_URL="postgres://..." python manage.py migrate
   ```
5. Health check `GET /api/health/` should answer 200. Static admin assets are served by
   WhiteNoise (already `collectstatic`'d in the image).

## Admin login after deploy

The deployed admin (`https://<backend>.onrender.com/admin/dashboard/login/`, plus the
Django admin at `/admin/`) reads from the **production** database, not your local
`db.sqlite3`. A superuser created locally will never appear there.

1. Open the Render dashboard → your `boutique-backend` service → **Shell**.
2. Create the admin user against the production DB — either interactively:

   ```bash
   python manage.py createsuperuser
   ```

   or non-interactively from env vars set in the Render dashboard
   (`DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD`):

   ```bash
   python manage.py ensure_superuser   # command is idempotent; re-runs also reset the password
   ```

   (You can also run either command locally with `DATABASE_URL` set to the production
   connection string — just never rely on the local SQLite admin users for production.)
3. Sign in at `https://<backend>.onrender.com/admin/dashboard/login/`.

Tests/customers explained: customers authenticate entirely through **Supabase Auth**
(`auth.users`), so a working sign-up always lives in the Supabase dashboard under
*Authentication → Users* for project `ngpzjddvkgopfmghjqnv`. Django only creates a
matching `auth_user` (username `supabase_<uuid>`) the first time that customer calls an
authenticated API endpoint (`GET /api/auth/me`), which is also where the admin
"Customers" page gets its rows.

## Deploy the frontend to Vercel

1. In Vercel: **Import Project →** repo, framework preset **Vite**, root `frontend`.
2. `vercel.json` (already present) forces `vite build`, output `dist`, and rewrites
   client-side routes to `index.html`.
3. Set project environment variables (`VITE_*` are baked into the bundle at build time):
   - `VITE_API_BASE_URL=https://<backend>.onrender.com`
   - `VITE_ADMIN_URL=https://<backend>.onrender.com/admin/dashboard/`
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public keys only).
4. Add the Vercel URL to the backend's `FRONTEND_ORIGIN` (CORS) and `DJANGO_ALLOWED_HOSTS`.

## Post-deploy checklist

- [ ] `GET https://<backend>/api/health/` returns 200.
- [ ] Superuser created via the Render Shell (`python manage.py ensure_superuser`) and
      `https://<backend>/admin/dashboard/login/` accepts it.
- [ ] `https://<frontend>/#/` serves the SPA and deep links (e.g. `/product/…`) refresh correctly.
- [ ] Guest adds to cart → signs in → checkout prefill shows account data.
- [ ] `https://<backend>/admin/dashboard/audit-logs/` lists orders, payments,
      logins and security events; `POST https://<backend>/api/audit/events`
      returns 202 for storefront events.
- [ ] M-Pesa callbacks can reach `https://<backend>/api/payments/mpesa/callback`
      (sandbox first via `MPESA_ENV=sandbox`). `PAYMENT_SANDBOX=true` completes
      the intent in-process so orders can reach PAID and be approved.
- [ ] CORS: frontend origin is in `FRONTEND_ORIGIN`; cookie-flags work over HTTPS.
- [ ] `https://<backend>/admin/dashboard/emails/` loads and a test order produces a
      row there. Delivery is off (`EMAIL_ENABLED=false`), so rows stay `QUEUED`
      and the page carries the deactivation banner — that is the expected state
      until a sending domain exists.
- [ ] Sweeper endpoint answers `POST https://<backend>/api/admin/emails/sweep`
      with `x-sweep-token` and returns 401 when the token is wrong.

## Background work (bulk imports & email)

Bulk product imports and outbound email are driven by Celery, but the
deployment ships **without a worker**: `render.yaml` sets
`CELERY_WORKER_ENABLED=false`, so imports run inline in the web process with
byte-for-byte the same retry, idempotency and audit behaviour. Local
development needs no Redis either — `python manage.py runserver` is enough.

Email is **currently deactivated** (`EMAIL_ENABLED=false`). Nothing touches a
transport: checkout still writes an `EmailLog` row, so the admin email page
shows exactly what would have gone out, but no row ever reaches `SENT` and no
retry loop runs. Set `EMAIL_ENABLED=true` to re-arm it, which also requires
`EMAIL_DELIVERY_MODE=deferred` — a mode in which a web request never opens a
socket for mail and rows are delivered by `POST /api/admin/emails/sweep`,
guarded by `EMAIL_SWEEP_TOKEN` and called once a minute by a **free external
cron** (cron-job.org — Render's own cron jobs are a paid service type).

After a restart on the free plan (its Redis is in-memory) rebuild any lost work:

```bash
python manage.py requeue_stuck_imports --dry-run
python manage.py requeue_stuck_emails   --dry-run
```

Full runbook — switches, queues, retry ladders, the sweeper endpoint, and how
to enable the worker on a paid plan — is in `backend/docs/CELERY.md`.

## Observability (logging & audit)

Every request carries a `X-Request-ID` (echoed in responses) that is attached to
structured log lines and audit records. `AuditLogService` centralizes audit writes
with sanitization, an admin **Activity Logs** page at `/admin/dashboard/audit-logs/`,
and `python manage.py cleanup_audit_logs --days N` for retention. The browser reports
storefront events (signup/login/checkout/…) to the throttled, authenticated
`POST /api/audit/events` endpoint. See `backend/docs/LOGGING.md` for the full details.