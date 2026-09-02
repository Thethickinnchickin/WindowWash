# Production Deployment

This app is a full-stack Next.js service with Postgres, Redis/BullMQ, Stripe, Twilio, SMTP email, and worker photo uploads.

## Recommended Host

Use Railway for the first production launch unless you already have an operations team for AWS/GCP. It fits this codebase well because the app needs a web service, Postgres, Redis, a long-running background worker, scheduled jobs, logs, environment variables, health checks, and custom domains in one project.

For a real business, do not run this as a single free or hobby-style instance. Run the web process with at least 2 replicas, configure backups, and use external uptime monitoring. Since `a1parola.com` is staying on GoDaddy DNS, use GoDaddy for DNS records and domain forwarding; add a dedicated WAF/DDoS layer later if the business needs more edge protection.

## Production Target

Use this production baseline for `a1parola`:

- Region: `US West Metal`, California, region identifier `us-west2`.
- Customer URL: `https://www.a1parola.com`.
- Staff/admin URL: `https://app.a1parola.com`.
- Web replicas: `2` in `us-west2`.
- Worker replicas: `1` in `us-west2`.
- Database: Postgres with backups enabled before launch.
- Redis: one Redis service to back BullMQ/background jobs.
- Photos: S3-compatible object storage, not local filesystem.
- Uptime monitor: external 1-minute check against `https://app.a1parola.com/api/health`.

Without a fixed budget, this is the minimum I would consider acceptable for launch. Stronger uptime means enabling Postgres HA/PITR, Redis HA, multi-region web replicas, and a WAF/CDN layer, but those add cost.

## Services

Create these Railway resources in one production project:

- `web`: this repository, build command `npm run build`, start command `npm run start`.
- `worker`: this repository, same build command, start command `npm run start:worker`.
- `postgres`: managed PostgreSQL, referenced by both `web` and `worker` as `DATABASE_URL`.
- `redis`: managed Redis, referenced by both `web` and `worker` as `REDIS_URL`.
- `uploads`: S3-compatible object storage, such as Railway Buckets, S3, or Cloudflare R2.
- `cron-reminders`: scheduled job that calls `/api/internal/jobs/reminders` with `x-cron-secret`.
- `cron-payments`: scheduled job that calls `/api/internal/payments/reconcile` with `x-cron-secret`.

Configure the `web` service health check path as:

```text
/api/health
```

Use a restart policy that restarts crashed services. Keep the worker as one replica unless duplicate job processing has been reviewed.

Set both `web` and `worker` to the `US West Metal` / `us-west2` region. Set `web` to 2 replicas. Keep `worker` at 1 replica until the queue/idempotency behavior has been reviewed under duplicate workers.

## Required Production Variables

Set these on both `web` and `worker` unless noted:

```text
DATABASE_URL=
REDIS_URL=
APP_BASE_URL=https://app.a1parola.com
PORTAL_BASE_URL=https://www.a1parola.com
CSRF_TRUSTED_ORIGINS=https://app.a1parola.com,https://www.a1parola.com
AUTH_SECRET=
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
CRON_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
PHOTO_STORAGE_DRIVER=s3
S3_BUCKET=
S3_REGION=auto
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
COMPANY_NAME=a1parola
CUSTOMER_RESCHEDULE_MIN_HOURS=12
CUSTOMER_CANCEL_MIN_HOURS=12
CUSTOMER_RESCHEDULE_FEE_WINDOW_HOURS=24
CUSTOMER_RESCHEDULE_FEE_CENTS=2500
CUSTOMER_CANCEL_FEE_WINDOW_HOURS=24
CUSTOMER_CANCEL_FEE_CENTS=5000
```

Generate `AUTH_SECRET` and `CRON_SECRET` as different random 32+ character values.

Run this before launch in the same environment variables:

```bash
npm run validate:production
```

## Database Migration

Before a new web deployment serves traffic, run:

```bash
npm run prisma:deploy
```

On Railway, set this as the web service pre-deploy command after the production variables are configured:

```bash
npm run validate:production && npm run prisma:deploy
```

Do not run `prisma migrate dev` against production.

## Domain Setup

Recommended domain split for `a1parola.com`:

- Customer booking and portal: `www.a1parola.com`
- Staff/admin app: `app.a1parola.com`
- Bare domain: `a1parola.com` forwards to `https://www.a1parola.com`

In Railway, add custom domains to the `web` service for both hosts. Railway will show the DNS records to create and will issue TLS certificates after verification.

With GoDaddy DNS, `www` and `app` are straightforward CNAME records. The root/apex domain (`a1parola.com`) is the tricky part because GoDaddy does not support Railway's preferred apex CNAME flattening style. Use this GoDaddy-only production pattern:

- Add `www.a1parola.com` as a Railway custom domain and create the CNAME Railway gives you in GoDaddy.
- Add `app.a1parola.com` as a Railway custom domain and create the CNAME Railway gives you in GoDaddy.
- In GoDaddy, forward `a1parola.com` to `https://www.a1parola.com`.
- Do not point the root domain to a fixed Railway IP unless Railway explicitly provides that for your service; use the Railway-provided records.

After domains are live, update:

```text
APP_BASE_URL=https://app.a1parola.com
PORTAL_BASE_URL=https://www.a1parola.com
CSRF_TRUSTED_ORIGINS=https://app.a1parola.com,https://www.a1parola.com
```

## Stripe

In Stripe production mode:

- Use live keys only: `sk_live_...` and `pk_live_...`.
- Add webhook endpoint: `https://app.a1parola.com/api/stripe/webhook`.
- Subscribe to PaymentIntent and SetupIntent events used by the app.
- Copy the production webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Cron

Configure scheduled jobs to call these endpoints with header `x-cron-secret: <CRON_SECRET>`:

```text
GET https://app.a1parola.com/api/internal/jobs/reminders
GET https://app.a1parola.com/api/internal/payments/reconcile
```

Run reminders every 15 minutes. Run payment reconciliation every 15 minutes.

## Uploads

Set `PHOTO_STORAGE_DRIVER=s3` in production. Uploaded job photos are written to an S3-compatible bucket and served through an authenticated app route, so the web service can run multiple replicas without losing or splitting uploaded files.

Railway Buckets expose Railway variable names (`BUCKET`, `REGION`, `ENDPOINT`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`). The app also accepts generic names (`S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). Prefer generic names if you might move providers later.

Use `PHOTO_STORAGE_DRIVER=filesystem` only for local development.

## Availability Checklist

- Web service has at least 2 replicas.
- Web and worker services are deployed in `US West Metal` / `us-west2`.
- Health check path is `/api/health`.
- `PHOTO_STORAGE_DRIVER=s3` and a bucket upload/download test has passed.
- Restart policy is enabled for `web` and `worker`.
- Postgres backups are scheduled and a restore has been tested.
- Redis is configured and monitored.
- Stripe webhook delivery is monitored.
- Twilio SMS errors are monitored.
- SMTP errors are monitored.
- External uptime monitoring checks `/api/health` every 1 minute.
- GoDaddy forwards `a1parola.com` to `https://www.a1parola.com`.
- A WAF/DDoS layer has been evaluated if traffic or risk justifies it.
- Staging environment exists and production deploys only from the main branch.
- Rollback procedure is known before launch.

## Info Needed From You

- Confirm the production URLs: `https://www.a1parola.com` for customers and `https://app.a1parola.com` for staff/admin.
- Railway project/workspace name, GitHub repo connected to Railway, and whether I should create the services or you will create them and send screenshots/settings.
- Railway billing plan/budget so replicas, backups, and database size are set realistically.
- Preferred Railway region, usually closest to your customers and workers.
- Permission to create these Railway resources: `web`, `worker`, Postgres, Redis, object storage bucket, reminder cron, payment reconciliation cron.
- GoDaddy DNS access or screenshots of the DNS page after Railway gives the CNAME targets.
- Stripe live secret key, live publishable key, and live webhook signing secret.
- Twilio account SID, auth token, and sending phone number.
- SMTP provider settings, `EMAIL_FROM`, and the inbox that should receive replies/errors.
- Business display name, support email, and support phone number.
- Production admin account email and initial employee emails.
- Backup retention requirement and acceptable recovery time after an outage.
- Who should receive uptime alerts, Stripe webhook alerts, Twilio alerts, and email delivery alerts.
