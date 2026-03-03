# Window Wash Ops MVP

Production-oriented MVP for a real window washing operation:

- Worker app (iPad-friendly PWA)
- Admin dashboard
- Secure backend API with Prisma/Postgres
- Auth, role permissions, audit trail, SMS logging, Stripe payments, offline outbox sync

## Stack

- Next.js App Router + TypeScript + Tailwind
- Prisma + PostgreSQL
- Zod validation
- JWT session cookie auth (HttpOnly)
- Twilio SMS (with automatic mock mode if Twilio env vars are missing)
- Stripe Payment Intents + webhook confirmation

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

### Backend

- Auth routes (`/api/auth/login`, `/logout`, `/me`)
- Worker job routes (`/api/jobs`, `/api/jobs/:id`, status/note/message/issue)
- Payments:
  - `POST /api/jobs/:id/payments/stripe-intent`
  - `POST /api/jobs/:id/payments/cash`
  - `POST /api/jobs/:id/payments/check`
  - `POST /api/stripe/webhook`
- Admin routes for customers/jobs/workers
- Idempotency key support for retry-safe operations
- Audit events persisted in `JobEvent`
- SMS attempt logging persisted in `SmsLog`

### PWA

- Manifest (`/manifest.webmanifest`)
- Service worker (`public/sw.js`) caches app shell + offline fallback
- Install instructions in worker Settings page

## Data Model

Prisma schema includes:

- `User`
- `Customer`
- `Job`
- `JobEvent`
- `Payment`
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
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`; app uses `AUTH_SECRET` first)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `COMPANY_NAME`

Strongly recommended for card UI:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

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

On `payment_intent.succeeded` webhook:

- Payment is marked `succeeded`
- Job status is moved to `paid`
- Payment/Status `JobEvent` rows are appended
- Paid SMS is triggered/logged

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
