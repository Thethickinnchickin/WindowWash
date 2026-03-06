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
  - cash/check payments (offline-queueable)
  - card payment collection (Stripe Payment Element)
- Offline outbox queue for:
  - status updates
  - notes
  - cash/check payment records
- Auto retry sync every 15s + on reconnect
- Pending sync indicators

### Admin dashboard

- Customers CRUD (including `smsOptOut`)
- Jobs CRUD + assign + cancel + reschedule + detail timeline
- Worker account create + password reset
- Dashboard counters

### Customer booking site

- Public booking flow at `/book`
- Clear path for returning customers (`/customer/login`)
- Customer portal (`/customer/portal`) for appointments and saved cards
- Guest scheduling or optional account creation during booking
- Optional card-on-file setup using Stripe SetupIntent + Payment Element
- Creates Job records and optional customer portal account records

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
  - `POST /api/customer/auth/login`
  - `POST /api/customer/auth/logout`
  - `GET /api/customer/portal`
  - `POST /api/customer/setup-intent`
  - `POST /api/stripe/webhook`
  - `POST /api/internal/payments/reconcile`
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
- `CRON_SECRET` (required for `/api/internal/payments/reconcile`)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `COMPANY_NAME`

Strongly recommended for card UI:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Auth Security

- Login endpoints enforce Redis-backed rate limiting/lockout in production.
- Dev/local falls back to in-memory limiter if Redis is not configured.
- CSRF protection is enforced on mutating `/api/*` routes via origin/referer validation.
- Exempt from CSRF origin checks: `/api/stripe/webhook`, `/api/internal/payments/reconcile`.
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
- Failed processing is retried with backoff and moved to dead-letter after max attempts.
- Reconciliation endpoint reprocesses due webhooks and stale pending Stripe payments:
  - `POST /api/internal/payments/reconcile`
  - Header: `x-cron-secret: <CRON_SECRET>`

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
