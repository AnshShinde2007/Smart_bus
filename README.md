# SmartBus

Next.js App Router application for passenger booking, driver trip tracking, and operator management.

## Local demo

```powershell
npm install
npm run dev
```

The local development server seeds one route, two buses, scheduled trips, and demo users:

- Admin: `admin@smartbus.test` / `DemoAdmin!2026`
- Driver: `driver@smartbus.test` / `DemoDriver!2026`
- Passenger: `passenger@smartbus.test` / `DemoPassenger!2026`

Bookings use a server-side dummy payment flow. Checkout asks before simulating a successful payment; no money is collected. Demo account credentials are never returned in production.

## Production setup

Copy `.env.example` to `.env.local`. Local development uses SQLite. For Vercel, set `SUPABASE_DB_URL` to the Supabase Postgres connection string and provision the initial administrator with `SMARTBUS_ADMIN_EMAIL` and a random `SMARTBUS_ADMIN_PASSWORD` of at least 16 characters. The application creates its tables on first use. Payments remain simulated; do not use this dummy gateway to collect real money.

Production uses Supabase Postgres with transactional seat holds. Use the Supabase transaction-pooler connection string for Vercel and store it as the private `SUPABASE_DB_URL` environment variable. Existing local SQLite data is not copied automatically.

The map defaults to OpenStreetMap tiles with visible attribution. Its community tile service is best-effort and has usage limits; configure a suitable tile provider for commercial/high-volume use. Location history is pruned to 30 days, and passenger endpoints suppress GPS fixes older than two minutes.
