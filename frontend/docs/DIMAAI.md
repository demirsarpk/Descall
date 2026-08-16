# DimaAI (Dima 1.0)

In-app assistant inside Descall. Users only see **DimaAI** / **Dima 1.0**. The initial model provider is a server-side implementation detail.

## Run locally

1. Apply `supabase/migrations/20260816_dimaai.sql` (already applied on the Descall Supabase project if this branch was migrated).
2. Backend (`frontend/backend`):

```bash
cd frontend/backend
npm start
```

3. Frontend Vite (`frontend`): `npm run dev`
4. Sign in, open the **DimaAI** item in the nav rail (`/dimaai`).

## Provider keys (admin)

Preferred path: **Admin panel → DimaAI**.

Admins can add **as many keys as they want**. Secrets are encrypted with `JWT_SECRET` (or `DIMA_KEY_ENCRYPTION_SECRET`) and never returned in full. The UI shows a mask (`AIza...8F2K`).

You can also bootstrap from Render env (read-only in the admin list):

```
GEMINI_API_KEY=
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
DIMA_KEY_ENCRYPTION_SECRET=   # optional; defaults to JWT_SECRET
```

These belong on **Render** (API), not Vercel. Vercel only hosts the static SPA.

## Failover

Dima sticks to the preferred / last-successful key. It tries the next configured key only on auth failure or provider unavailability. HTTP 429 (quota) does **not** rotate keys.

## Deploy

1. Merge this branch so Render redeploys the Express API (`/api/dimaai`).
2. Add keys in Admin → DimaAI (or set env vars, then redeploy).
3. Vercel SPA deploy picks up the DimaAI UI automatically (no extra Vercel secrets).
