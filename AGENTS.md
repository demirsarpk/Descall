# AGENTS.md

## Cursor Cloud specific instructions

### Auth
- Descall uses **custom JWT** (`JWT_SECRET`); Supabase is DB/storage only (service role), not Supabase Auth.
- Google Sign-In: GIS ID token → `POST /auth/google` → same app JWT. Requires `GOOGLE_CLIENT_ID` (and ideally `VITE_GOOGLE_CLIENT_ID` at frontend build). If client ID is missing, the UI shows “not configured” and password auth still works.
- Before Google login works end-to-end, apply `supabase/migrations/20260729_add_google_oauth_columns.sql` (adds `email`, `google_id`, `auth_provider`; makes `password_hash` nullable).
- Google-only accounts have `password_hash = null`; password login returns a message to use Google.

### Services
- Backend: `frontend/backend` (Express + Socket.IO). Frontend Vite app is served from backend `dist` in production; local UI via Vite. See `README.md` / `frontend/package.json` scripts.
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (required); `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` (optional until OAuth is enabled).
