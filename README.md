# Window Wash Ops MVP

Production-oriented MVP for a real window washing operation:

- Worker app (iPad-friendly PWA)
- Admin dashboard
- Customer booking website (`/book`)
- Secure backend API with Prisma/Postgres
- Auth, role permissions, audit trail, SMS logging, Stripe payments, offline outbox sync

## Stack

- Next.js App Router + TypeScript + Tailwind
- Prisma + PostgreSQL
- Zod validation
- JWT session cookie auth (HttpOnly)
- Twilio SMS (with automatic mock mode if Twilio env vars are missing)
- Stripe Payment Intents + webhook confirmation
- Stripe SetupIntents for card-on-file capture

## Features Implemented

### Roles and permissions

- `admin` and `worker` roles
- Server-side authorization enforced on every API route
- Worker can only access jobs assigned to them
- Admin can manage customers/jobs/workers and view job logs/payments/SMS

### Worker app (iPad/PWA)

- Tabs: Today, Upcoming, Job Search, Messages, Settings
- Large touch targets (`min-h-11` / 44px)
- Job list filters (date range + status + search)
- Job details:
  - status actions (forward only for workers)
  - notes
  - customer messaging templates/custom
  - issue reporting
  - before/after/issue photo uploads (camera/file) + placeholder fallback
  - cash/check payments (offline-queueable)
  - card payment collection (Stripe Payment Element)
- Route optimization in Today/Upcoming lists (nearest-neighbor using geocoded jobs + optional device location)
- One-tap multi-stop route launch (Google Maps deep link in optimized order)
- Offline outbox queue for:
  - status updates
  - notes
  - cash/check payment records
- Auto retry sync every 15s + on reconnect
- Pending sync indicators

### Admin dashboard

- Customers CRUD (including `smsOptOut`)
- Jobs CRUD + assign + cancel + reschedule + detail timeline
- Dispatch board (`/admin/dispatch`) with drag/drop reassign, overlap conflict alerts, and no-show flags
- Worker account create + password reset
- Worker region (`serviceState`) + daily capacity configuration
- Daily operational KPIs (jobs due, jobs at risk, failed payments/SMS, unpaid jobs, revenue today)
- CSV exports for jobs, payments, and SMS logs
- Admin resend of invoice/receipt PDFs from job detail and per-payment rows

### Customer booking site

- Public booking flow at `/book`
- Clear path for returning customers (`/customer/login`)
- Customer portal (`/customer/portal`) for appointments and saved cards
- Guest scheduling or optional account creation during booking
- Public availability API-backed slot discovery for booking date
- Automatic worker assignment from availability/capacity engine
- Optional card-on-file setup using Stripe SetupIntent + Payment Element
- Creates Job records and optional customer portal account records
- Customer self-service reschedule and cancel with policy cutoffs
- Customer policy fees for late reschedule/cancel with optional deposit credit application
- Appointment reminder SMS flow with secure confirmation links

### Backend

- Auth routes (`/api/auth/login`, `/logout`, `/me`)
- Worker job routes (`/api/jobs`, `/api/jobs/:id`, status/note/message/issue)
- Payments:
  - `POST /api/jobs/:id/payments/stripe-intent`
  - `POST /api/jobs/:id/payments/cash`
  - `POST /api/jobs/:id/payments/check`
  - `POST /api/jobs/:id/payments/saved-card`
  - `POST /api/admin/payments/:id/refund`
  - `POST /api/admin/payments/:id/void`
  - `POST /api/public/appointments`
  - `GET /api/public/availability`
  - `POST /api/customer/auth/login`
  - `POST /api/customer/auth/logout`
  - `GET /api/customer/portal`
  - `POST /api/customer/appointments/:id/reschedule`
  - `POST /api/customer/appointments/:id/cancel`
  - `POST /api/customer/setup-intent`
  - `GET|POST /api/internal/jobs/reminders` (cron-protected reminder dispatch)
  - `GET|POST /api/public/appointments/:id/confirm` (tokenized confirmation link)
  - `GET /api/admin/exports/jobs`
  - `GET /api/admin/exports/payments`
  - `GET /api/admin/exports/sms`
  - `GET /api/admin/dispatch`
  - `POST /api/admin/dispatch/reassign`
  - `POST /api/admin/jobs/:id/no-show`
  - `POST /api/admin/jobs/:id/invoice-email`
  - `POST /api/stripe/webhook`
  - `GET|POST /api/internal/payments/reconcile`
- Admin routes for customers/jobs/workers
- Idempotency key support for retry-safe operations
- Audit events persisted in `JobEvent`
- SMS attempt logging persisted in `SmsLog`
- Stripe webhooks persisted/retried with dead-letter handling (`StripeWebhookEvent`)

### PWA

- Manifest (`/manifest.webmanifest`)
- Service worker (`public/sw.js`) caches app shell + offline fallback
- Install instructions in worker Settings page

## Data Model

Prisma schema includes:

- `User`
- `Customer`
- `CustomerPortalAccount`
- `CustomerPaymentMethod`
- `Job`
- `JobPhoto`
- `JobEvent`
- `Payment`
- `PaymentRefund`
- `StripeWebhookEvent`
- `SmsLog`
- `IdempotencyKey`

Indexes included for required query patterns.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and configure values:

```bash
cp .env.example .env
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Run migrations:

```bash
npm run prisma:deploy
```

5. Seed sample data:

```bash
npm run db:seed
```

6. Start dev server:

```bash
npm run dev
```

7. (Production recommended) run background worker process:

```bash
npm run worker:background
```

## Seeded Accounts

After `npm run db:seed`:

- Admin: `admin@windowwash.local` / `Password123!`
- Worker: `wendy@windowwash.local` / `Password123!`
- Worker: `ben@windowwash.local` / `Password123!`

Seed also creates:

- 3 customers
- 8 jobs across today/upcoming with mixed statuses

## Environment Variables

Required:

- `DATABASE_URL`
- `REDIS_URL` (required in production for login security rate limiting/lockout)
- `CSRF_TRUSTED_ORIGINS` (optional comma-separated origins if using multiple domains/subdomains)
- `APP_BASE_URL` (optional; staff domain, e.g. `https://app.example.com`)
- `PORTAL_BASE_URL` (optional; customer domain, e.g. `https://portal.example.com`)
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`; must be random, at least 32 chars, and non-placeholder)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET` (required for `/api/internal/payments/reconcile` and `/api/internal/jobs/reminders`)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `SMTP_HOST` (optional, for real email send)
- `SMTP_PORT` (optional, default `587`)
- `SMTP_USER` (optional)
- `SMTP_PASS` (optional)
- `EMAIL_FROM` (optional)
- `PHOTO_UPLOAD_DIR` (optional; defaults to `public/uploads/jobs`)
- `COMPANY_NAME`
- `CUSTOMER_RESCHEDULE_MIN_HOURS` (optional, default `12`)
- `CUSTOMER_CANCEL_MIN_HOURS` (optional, default `12`)
- `CUSTOMER_RESCHEDULE_FEE_WINDOW_HOURS` (optional, default `24`)
- `CUSTOMER_RESCHEDULE_FEE_CENTS` (optional, default `2500`)
- `CUSTOMER_CANCEL_FEE_WINDOW_HOURS` (optional, default `24`)
- `CUSTOMER_CANCEL_FEE_CENTS` (optional, default `5000`)

Strongly recommended for card UI:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Auth Security

- Login endpoints enforce Redis-backed rate limiting/lockout in production.
- Dev/local falls back to in-memory limiter if Redis is not configured.
- CSRF protection is enforced on mutating `/api/*` routes via origin/referer validation.
- Exempt from CSRF origin checks: `/api/stripe/webhook`, `/api/internal/payments/reconcile`, `/api/internal/jobs/reminders`.
- Repeated failed logins trigger temporary lockout.
- Session cookies use shorter TTLs (7d remember-me, 8h non-remember).
- Session tokens rotate automatically on active use.

## Domain Split (Staff vs Customer)

Set both `APP_BASE_URL` and `PORTAL_BASE_URL` to enforce route/domain separation:

- Staff paths (`/admin`, `/worker`, `/team`, `/api/admin`, `/api/jobs`, `/api/auth`) are pinned to `APP_BASE_URL`.
- Customer/public paths (`/book`, `/customer`, `/api/customer`, `/api/public`) are pinned to `PORTAL_BASE_URL`.
- Wrong-domain page requests are redirected to the correct host.
- Wrong-domain API requests are rejected with `WRONG_SUBDOMAIN` (HTTP 421).

## Twilio Mock Mode

If Twilio credentials are missing, SMS sends are mocked:

- payload logged to server console
- `SmsLog` record saved with `status = mock_sent`
- `JobEvent` entry still created

This allows local/dev testing without Twilio.

## Stripe Local Testing

1. Set Stripe keys in `.env`.
2. Run app (`npm run dev`).
3. In a second terminal, forward Stripe webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

4. Copy webhook signing secret from Stripe CLI into `STRIPE_WEBHOOK_SECRET`.
5. Open worker job detail (finished job), click `Collect Card`, submit test card.
6. Optional card-on-file test: open `/book`, schedule with "Save card on file", then complete setup form.

On `payment_intent.succeeded` webhook:

- Payment is marked `succeeded`
- Job status is moved to `paid`
- Payment/Status `JobEvent` rows are appended
- Paid SMS is triggered/logged

On `setup_intent.succeeded` webhook:

- Saved card is persisted into `CustomerPaymentMethod`
- Worker can later charge the saved card from job details

Webhook robustness:

- Each Stripe webhook is persisted in `StripeWebhookEvent`.
- Webhook processing is queued in Redis/BullMQ and failed processing is retried with backoff.
- Events still move to dead-letter after max attempts in `StripeWebhookEvent`.
- Reconciliation endpoint reprocesses due webhooks and stale pending Stripe payments:
  - `GET|POST /api/internal/payments/reconcile`
  - Header: `x-cron-secret: <CRON_SECRET>`

Reminder dispatch:

- Cron endpoint sends 24h/2h reminder texts with secure confirm links:
  - `GET|POST /api/internal/jobs/reminders`
  - Header: `x-cron-secret: <CRON_SECRET>`
- Confirmation links mark `Job.customerConfirmedAt` and append a `JobEvent`.

## API Error Shape

All routes return consistent error responses:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## Notes

- Outbox queue currently uses localStorage (acceptable for MVP per requirement).
- Stripe card confirmation requires live network.
- Cash/check updates can be queued offline and synced later via idempotent retries.
- Route optimization/geocode uses OpenStreetMap Nominatim lookups; jobs without coordinates stay in schedule order after optimized stops.
