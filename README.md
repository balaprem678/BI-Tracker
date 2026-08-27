# BI-Tracker

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. In the Supabase dashboard, open **Project Settings > API** and copy the project URL, publishable key, and a server-only secret key into `.env`.
4. Apply the SQL files in `supabase/migrations/` to the same Supabase project.
5. Start the app with `npm run dev`.

The secret key is required because the first-admin and employee-management flows use Supabase Auth admin APIs. Keep `SUPABASE_SECRET_KEY` server-only; do not prefix it with `VITE_` or commit `.env`.