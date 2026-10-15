# VG Unisex Saloon

Website, online booking, customer portal and salon management dashboard for **VG Unisex Saloon**
(owner: Varshika Rajput), Bade Bazar, Old Rajendra Nagar, Delhi. One salon, one location.

This project started as the "VR Nails" press-on-nail storefront and was converted in place. The
store pages (shop, product, cart, checkout, wishlist) used hardcoded demo products and a simulated
checkout, so they were retired; their URLs permanently redirect to the matching salon pages.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS 4 — the existing stack.
- **MongoDB + Mongoose** for data (added; the original project had no backend).
- API: Next.js route handlers in `src/app/api/**`, business logic in `src/server/services/**`.
- No other runtime dependencies were added. Passwords use Node's built-in `scrypt`; Razorpay and
  Resend are called over HTTPS with `fetch`.

```
src/
  app/(site)/        public website, booking, customer portal (/account)
  app/dashboard/     owner / receptionist / stylist dashboard
  app/api/           JSON APIs (public, account, admin, payments, cron)
  components/        UI kit (components/ui), site, booking, account, dashboard
  lib/               client-safe helpers: time (IST), money (paise/INR), permissions, api client
  server/            db connection, models, auth, validation, services (booking, billing, reports…)
scripts/             seed + create-owner
tests/               unit, integration (MongoDB) and end-to-end smoke tests
```

## Getting started (development)

Requirements: Node.js 20.9+ (22 recommended) and MongoDB 6+ (local or Atlas).

```bash
npm install
cp .env.example .env.local          # then edit MONGODB_URI etc.
npm run seed                        # settings, indexes, suggested service menu (no customers/bookings)
npm run create-owner -- --email you@example.com
npm run dev                         # http://localhost:3000
```

`create-owner` prompts for the password (or reads `OWNER_PASSWORD`). It refuses to create a second
owner; use `--reset-password` to change the owner's password (this signs out all sessions).

### Before launch — owner checklist

The app deliberately **does not invent business details**. Until you fill these in, the website shows
neutral placeholders such as "Price confirmed at salon" or "Opening hours will be published soon".

1. **Dashboard → Services**: the seeded prices are *samples*. Edit each price and tick "Price verified"
   (or press "Verify price"). Deactivate services you don't offer (Nail Art and the Festival package
   start inactive).
2. **Settings → Business & contact**: phone, WhatsApp, email, street address, PIN, Google Maps link,
   then tick the "verified" boxes to publish them.
3. **Settings → Opening hours**: set real hours and breaks, then tick "hours are confirmed".
   Booking uses these hours immediately (default 10:00–20:00 daily).
4. **Settings → Payments, tax & invoices**: enable the methods you accept, your UPI ID, and GST
   (rate, inclusive/exclusive, GSTIN) only after confirming with your accountant.
5. **Settings → Booking & policies**: cancellation cut-off, lead time, auto-confirm, policy text.
6. Review the Privacy Policy and Terms pages with a legal adviser.
7. Replace stock imagery: the homepage uses licensed Unsplash photos labelled as inspiration until
   you upload your own work in **Dashboard → Gallery**.

## Features

**Public site**: home, services (search + category/audience filters), service details, offers &
packages, gallery, reviews (moderated, from completed appointments only), about, contact form, FAQ,
booking & cancellation policy, privacy, terms. All dates are DD/MM/YYYY and times 12-hour IST.

**Booking**: services → optional add-ons → stylist (or any) → date & live slots → details → review →
confirmation with reference (e.g. `VGAB12CD`) and calendar file. Guest booking is optional; guests
manage bookings with reference + phone (POST, rate-limited, never in the URL).

- Duration = sum of services; buffer = the largest buffer of the selected services.
- Respects salon hours/breaks, per-stylist hours/breaks, holidays/closures, leave, blocked time,
  minimum notice and maximum advance window.
- **Double booking is impossible**: every booked 5-minute block per stylist is a document under a
  unique index, so concurrent requests cannot both win (tested with 10 parallel requests). Server
  re-validates availability on every booking; idempotency keys stop duplicate submissions.
- Statuses: Pending → Confirmed → Checked In → In Progress → Completed, plus Cancelled and No-Show,
  with an audited history.

**Customer portal** (`/account`): upcoming/past appointments, cancel or reschedule within policy
(otherwise send a request), invoices (print/PDF, pay online when configured), reviews, loyalty
points & offers, in-app notifications, profile, notification preferences, password change.

**Dashboard** (`/dashboard`): overview with real figures and date filters; front desk (waiting queue,
in-chair, arrivals, walk-ins, phone bookings); appointments (day grid per stylist, week, filterable
list); customers (search, history, spend, notes, CSV export); billing/POS (appointment or walk-in
bills, extra services, retail products, custom items, coupons, manual discounts, loyalty redemption,
server-calculated tax, partial payments, refunds, void, printable receipts); services & categories;
staff & hours (roles, extra permissions, service eligibility, hours, breaks, leave, holidays); offers;
optional inventory; reviews moderation; gallery uploads; messages; reports with CSV export; settings;
activity log and notification delivery log.

### Roles & permissions

Enforced on the server for every API call (`src/lib/permissions.ts`); the UI only hides controls.

| Capability | Owner | Receptionist | Stylist | Customer |
|---|:-:|:-:|:-:|:-:|
| Own bookings, invoices, profile | ✓ | ✓ | ✓ | ✓ |
| View all appointments, book walk-ins, confirm, check in, reschedule, cancel | ✓ | ✓ | – | – |
| Own schedule; start/complete own appointments; own service notes | ✓ | – | ✓ | – |
| Manage own hours & leave | ✓ | – | ✓ | – |
| View customers & contact details | ✓ | ✓ | – | – |
| Edit customers / export customer data | ✓ | – / – | – | – |
| Billing & payments / discounts (capped %) | ✓ | ✓ | – | – |
| Refunds & voiding invoices | ✓ | – | – | – |
| Sales figures & reports | ✓ | – | – | – |
| Services, staff, offers, inventory, gallery, reviews, settings, audit log | ✓ | – | – | – |

The owner can grant individual extra permissions (e.g. "View reports", "Issue refunds") per staff
member. Staff accounts are optional; a sole owner can stay the only bookable stylist.

### Money, tax and reports

All amounts are integer paise. Discounts are applied coupon → manual → loyalty and are capped so a
total can never go negative. Tax is calculated on the discounted taxable amount (exclusive or
inclusive). Reports define: **Gross** = line totals; **Billed** = invoice totals; **Net sales** =
billed − refunds; **Collected** = payments received − refunds paid. Unpaid balances are never counted
as collected; void invoices are excluded.

MongoDB transactions need a replica set, which a single local server doesn't have, so money changes
use atomic conditional updates instead (e.g. "add payment only if balance ≥ amount", "redeem coupon
only if under its limit") with compensating rollbacks if a later step fails.

## Security

- scrypt password hashing; random 256-bit session tokens stored hashed, in `HttpOnly`, `SameSite=Lax`,
  `Secure` (production) cookies; sessions expire after 14 days and are revoked on password reset or
  deactivation.
- Role/permission checks on every admin API; customers can only read their own records (cross-account
  access returns 404).
- Same-origin check on all state-changing requests (CSRF); configure `APP_ORIGIN` if you serve the site
  under extra hostnames. No cross-origin API access is enabled (the site and API share an origin).
- Input validation on every route; regex search input is escaped; CSV exports are protected against
  formula injection.
- Rate limits on sign-in, registration, booking, guest lookup, contact and availability.
- Uploads: JPEG/PNG/WebP only, checked by file signature, 4 MB max, random file names, served from
  outside `/public` with `nosniff`.
- Payments: amounts are set by the server; card/UPI details never touch this app; Razorpay payments are
  only recorded after signature verification **and** a server-side status check; webhooks are
  HMAC-verified and idempotent.
- Audit log of administrative changes; security headers (`X-Frame-Options`, `nosniff`, etc.).
- The in-memory rate limiter is per process. If you run multiple instances, move it to Redis.

## Integrations that need credentials

| Integration | Status | How to enable |
|---|---|---|
| Online payments (Razorpay) | Implemented, **untested against live Razorpay** (no keys available) | Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; add webhook `https://<domain>/api/payments/razorpay/webhook` for `payment.captured` (auto-capture on); then enable in Settings. Test in Razorpay test mode first. Refunds of online payments must also be issued in the Razorpay dashboard. |
| Email (Resend) | Implemented, **untested against live provider** | Set `RESEND_API_KEY` and `EMAIL_FROM` (verified domain). Without it, emails are logged as "skipped". |
| SMS / WhatsApp | **Not implemented** — recorded as "skipped" | Requires choosing a provider (e.g. MSG91, Gupshup, Twilio WhatsApp) and DLT/template approval. |
| Appointment reminders | Implemented | Set `CRON_SECRET` and call `POST /api/cron/reminders` with `Authorization: Bearer <secret>` every ~15 min (e.g. Vercel Cron, GitHub Actions, or `cron` + `curl`). |

In-app notifications always work for registered customers. Delivery results (sent / failed / skipped)
are visible in **Dashboard → Activity log → Notification delivery**.

**Not built yet**: memberships, gift cards and referral credit (referral/seasonal/festival/first-visit
discounts can be run as coupon codes), password-reset by email (the owner resets staff passwords;
customers contact the salon), and OTP phone verification.

## Testing

```bash
npm test          # unit tests + MongoDB integration tests (uses MONGODB_URI_TEST, dropped first)
npm run lint
npm run typecheck
npm run build

# end-to-end smoke test against a running server (creates test records — dev DB only)
BASE_URL=http://localhost:3000 OWNER_EMAIL=... OWNER_PASSWORD=... node tests/e2e-smoke.mjs
```

The integration suite is skipped automatically if MongoDB isn't reachable.

## Deployment

### Vercel (recommended for this project)

`vercel.json` pins functions to Mumbai (`bom1`, next to the MongoDB Atlas cluster in ap-south-1) and
schedules the reminder job daily at 09:00 IST.

1. **MongoDB Atlas**: database user with a strong password; Network Access `0.0.0.0/0` (Vercel has no
   fixed IPs). Seed it once from your PC (PowerShell):
   `$env:MONGODB_URI="mongodb+srv://..."; npm run seed; npm run create-owner --email you@example.com`
2. **Vercel → Add New → Project**, import the GitHub repo. Framework: Next.js (build/output defaults).
3. **Environment variables** (Production): `MONGODB_URI`, `NEXT_PUBLIC_SITE_URL` (your https URL),
   `CRON_SECRET` (long random string), plus optional Razorpay / Resend keys.
4. **Storage → Create → Blob**, connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`, and
   gallery/service uploads are then stored in Vercel Blob (Vercel has no persistent disk; without Blob,
   uploads are refused with a clear message and you can still paste image links).
5. Deploy, then redeploy after adding Blob or changing environment variables.
6. Custom domain: **Settings → Domains**, then update `NEXT_PUBLIC_SITE_URL` and redeploy.

Vercel notes:
- Hobby-plan cron runs **once a day** (within the 09:00 IST hour). Reminders therefore go out each
  morning for appointments in the next `reminderHoursBefore` hours (default 24). For more frequent
  reminders, upgrade to Pro and change the schedule, or call `POST /api/cron/reminders` with
  `Authorization: Bearer <CRON_SECRET>` from cron-job.org.
- Rate limits are kept in memory per function instance, so they are weaker on Vercel. For stronger
  limits, add Vercel's Firewall rate-limiting rules for `/api/auth/*` and `/api/bookings*`.
- Upload size is limited to 4 MB (Vercel's request body limit is 4.5 MB).

### Any Node.js host (VPS, Render, Railway…)

The app is a single Next.js server (frontend + API). It needs a **persistent Node server** and a
MongoDB database.

1. Create a MongoDB database (MongoDB Atlas, Mumbai region recommended) and set `MONGODB_URI`.
2. Set environment variables from `.env.example` on the host. Set `NEXT_PUBLIC_SITE_URL` to the public
   https URL. Never commit `.env*` files.
3. `npm ci && npm run build && npm start` (port via `PORT`), behind HTTPS (Nginx/Caddy or the
   platform's TLS). Cookies are `Secure` in production, so HTTPS is required.
4. Run `npm run seed` once (safe to re-run; it never overwrites existing records) and
   `npm run create-owner -- --email ...`.
5. **Uploads**: images are written to `UPLOAD_DIR` (default `./uploads`). Use a persistent disk or
   volume and back it up. Serverless hosts (e.g. Vercel) have no persistent disk — there, keep using
   image URLs (Settings/Services accept https links) or move uploads to object storage (S3/R2) by
   replacing `src/server/services/uploads.ts`.
6. Schedule the reminder cron (above) and configure Razorpay/Resend if used.
7. Back up MongoDB regularly (Atlas backups or `mongodump`).
