# a1parola Ops

Production-oriented MVP for a real window washing operation:

- Worker app (iPad-friendly PWA)
- Admin dashboard
- Customer booking website (`/book`)
- Secure backend API with Prisma/Postgres
- Auth, role permissions, audit trail, SMS logging, manual paid marking, offline outbox sync

For production hosting, domains, required secrets, cron jobs, backups, and uptime expectations, see [`PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md).

## Local Demo

This machine may also have ignored helper launchers (`start.exe` and `restart.exe`) for a local tablet-emulator demo. They are not required for production deployment.

If those launchers are present, start the local demo from PowerShell:

```powershell
cd D:\Projects\WindowWash
.\start.exe
```

`start.exe` starts the Next.js backend, starts Expo Metro, opens the `WindowWashTabletApi33` Android tablet emulator, sets a mock GPS location, and launches the mobile app.

To fully restart the tablet emulator and relaunch the app:

```powershell
cd D:\Projects\WindowWash
.\restart.exe
```

Use these demo accounts:

- Admin web: `admin@windowwash.local` / `Password123!`
- Worker mobile: `wendy@windowwash.local` / `Password123!`
- Worker mobile: `ben@windowwash.local` / `Password123!`
- Customer portal: `jordan@example.com` / `Customer123!`
- Customer portal: `riley@example.com` / `Customer123!`

Local web demo URLs:

- Admin/team sign-in: `http://localhost:3000/team/sign-in`
- Customer booking: `http://localhost:3000/book`
- Customer portal: `http://localhost:3000/customer/login`

## Stack

- Next.js App Router + TypeScript + Tailwind
- Prisma + PostgreSQL
- Zod validation
- JWT session cookie auth (HttpOnly)
- Twilio SMS (with automatic mock mode if Twilio env vars are missing)
- Resend API email or SMTP email (with automatic mock mode if email env vars are missing)
- Manual payment confirmation after job completion

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
  - one-tap paid marking after job completion (offline-queueable)
- Route optimization in Today/Upcoming lists (nearest-neighbor using geocoded jobs + optional device location)
- One-tap multi-stop route launch (Google Maps deep link in optimized order)
- Offline outbox queue for:
  - status updates
  - notes
  - manual paid records
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
- Appointment scheduled emails with customer confirmation links
- Clear path for returning customers (`/customer/login`)
- Customer portal (`/customer/portal`) for appointments
- Guest scheduling or optional account creation during booking
- Public availability API-backed slot discovery for booking date
- Automatic worker assignment from availability/capacity engine
- Creates Job records and optional customer portal account records
- Customer self-service reschedule and cancel with policy cutoffs
- Customer policy fees for late reschedule/cancel
- Appointment reminder email flow and optional SMS flow with secure confirmation links
- Background worker queues reminder dispatch every 15 minutes

### Backend

- Auth routes (`/api/auth/login`, `/logout`, `/me`)
- Worker job routes (`/api/jobs`, `/api/jobs/:id`, status/note/message/issue)
- Payments:
  - `POST /api/jobs/:id/payments/paid`
  - `POST /api/admin/payments/:id/refund`
  - `POST /api/admin/payments/:id/void`
  - `POST /api/public/appointments`
  - `GET /api/public/availability`
  - `POST /api/customer/auth/login`
  - `POST /api/customer/auth/logout`
  - `GET /api/customer/portal`
  - `POST /api/customer/appointments/:id/reschedule`
  - `POST /api/customer/appointments/:id/cancel`
  - `GET|POST /api/internal/jobs/reminders` (cron-protected reminder dispatch)
  - `GET|POST /api/public/appointments/:id/confirm` (tokenized confirmation link)
  - `GET /api/admin/exports/jobs`
  - `GET /api/admin/exports/payments`
  - `GET /api/admin/exports/sms`
  - `GET /api/admin/dispatch`
  - `POST /api/admin/dispatch/reassign`
  - `POST /api/admin/jobs/:id/no-show`
  - `POST /api/admin/jobs/:id/invoice-email`
  - `GET|POST /api/internal/payments/reconcile`
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
- `CustomerPortalAccount`
- `CustomerPaymentMethod`
- `Job`
- `JobPhoto`
- `JobEvent`
- `Payment`
- `PaymentRefund`
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

Production builds use Next.js standalone output:

```bash
npm run build
npm run start
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
- `CRON_SECRET` (required for `/api/internal/payments/reconcile` and `/api/internal/jobs/reminders`)
- `TWILIO_ACCOUNT_SID` (optional, for real SMS send)
- `TWILIO_AUTH_TOKEN` (optional)
- `TWILIO_FROM_NUMBER` (optional)
- `SMTP_HOST` (optional, for real email send)
- `SMTP_PORT` (optional, default `587`)
- `SMTP_USER` (optional)
- `SMTP_PASS` (optional)
- `RESEND_API_KEY` (optional, preferred on Railway because it sends through HTTPS)
- `EMAIL_FROM` (optional)
- `PHOTO_UPLOAD_DIR` (optional; defaults to `public/uploads/jobs`)
- `COMPANY_NAME`
- `COMPANY_CONTACT_EMAIL` (optional; used as reply-to and invoice contact)
- `COMPANY_CONTACT_PHONE` (optional; used as invoice contact)
- `CUSTOMER_RESCHEDULE_MIN_HOURS` (optional, default `12`)
- `CUSTOMER_CANCEL_MIN_HOURS` (optional, default `12`)
- `CUSTOMER_RESCHEDULE_FEE_WINDOW_HOURS` (optional, default `24`)
- `CUSTOMER_RESCHEDULE_FEE_CENTS` (optional, default `2500`)
- `CUSTOMER_CANCEL_FEE_WINDOW_HOURS` (optional, default `24`)
- `CUSTOMER_CANCEL_FEE_CENTS` (optional, default `5000`)

## Auth Security

- Login endpoints enforce Redis-backed rate limiting/lockout in production.
- Dev/local falls back to in-memory limiter if Redis is not configured.
- CSRF protection is enforced on mutating `/api/*` routes via origin/referer validation.
- Exempt from CSRF origin checks: `/api/internal/payments/reconcile`, `/api/internal/jobs/reminders`.
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

## Email Sending

If `RESEND_API_KEY` and `EMAIL_FROM` are configured, invoice/receipt emails send through the Resend HTTPS API. This is preferred on Railway Free/Trial/Hobby plans because outbound SMTP is blocked on those plans.

SMTP remains supported when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` are configured. If neither Resend nor SMTP is configured, email sends are mocked and logged.

## Manual Payment Testing

1. Open a finished worker job detail.
2. Click `Mark Paid`.
3. Confirm the job moves to `paid`, a `manual` succeeded payment is recorded, and the paid SMS is logged.

Reminder dispatch:

- The background worker automatically queues reminder dispatch every 15 minutes.
- The internal endpoint can also be called manually or from an external cron:
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
- Manual paid updates can be queued offline and synced later via idempotent retries.
- Route optimization/geocode uses OpenStreetMap Nominatim lookups; jobs without coordinates stay in schedule order after optimized stops.
