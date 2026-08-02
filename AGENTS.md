# AGENTS.md

## Cursor Cloud specific instructions

### Auth
- Descall uses **custom JWT** (`JWT_SECRET`); Supabase is DB/storage only (service role), not Supabase Auth.
- Google Sign-In: GIS ID token → `POST /auth/google` → same app JWT. Requires `GOOGLE_CLIENT_ID` (and ideally `VITE_GOOGLE_CLIENT_ID` at frontend build). If client ID is missing, the UI shows “not configured” and password auth still works.
- Before Google login works end-to-end, apply `supabase/migrations/20260729_add_google_oauth_columns.sql` (adds `email`, `google_id`, `auth_provider`; makes `password_hash` nullable).
- Google-only accounts have `password_hash = null`; password login returns a message to use Google.

### Voice / group calls
- DM calls signal with `call:offer` → accept/reject UI is `CallOverlay` (`mode === "incoming"`).
- Group calls signal with `group:call:incoming` → accept/reject UI is `GroupCallIncomingModal`.
- Backend delivery uses Socket.IO `user:${userId}` rooms (not presence-map-only). Presence is kept if another tab stays connected.
- `useGroupCall(socket, currentUserId)` needs the logged-in user id — `socket.user` is **not** set on the client.
- After loading groups, always emit `groups:rejoin` so members are in group rooms for banners/fallback invites.
- Group start looks up `group_members` in DB when client `memberIds` is empty.
- Group screen share defaults to **720p @ ~20fps** with RTP `maxBitrate` / `maintain-framerate` (`src/lib/webrtcScreenShare.js`). Mesh encodes per peer — avoid 1080p+/60fps.
- **Screen quality UI** lives in `CallOverlay` via `ScreenShareQualityPanel` (DM + group). Changing quality while sharing restarts capture safely.
- **ICE/TURN**: client preloads `GET /api/webrtc/ice-config` (`src/lib/iceConfig.js`). Set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` on the backend (or `VITE_ICE_SERVERS` JSON on the frontend). Manual call checks: `docs/CALL_TEST_MATRIX.md`.
- **Download page** loads the desktop version from GitHub **`releases/latest`** via `GET /api/app/latest-release` (repo: `demirrsarppkurtlarr/Descall`). Bump semver with `frontend/electron/release.cjs` (`patch` / `minor` / `major`). See `docs/ELECTRON_RELEASE.md`.
- **Client errors** POST to `/api/errors` (mounted in `server.js`). `/debug/*` routes are disabled in production unless `ENABLE_DEBUG_ROUTES=true`.
- **Bans** persist in `users.is_banned` (migration `20250730_add_users_is_banned.sql`); loaded on server boot into `bannedUserIds`.

### Services
- Backend: `frontend/backend` (Express + Socket.IO). Frontend Vite app is served from backend `dist` in production; local UI via Vite. See `README.md` / `frontend/package.json` scripts.
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (required); `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` (optional until OAuth is enabled).

### Local development
- Copy `frontend/.env.example` → `frontend/.env`. Backend loads `frontend/.env` via `dotenv` in `server.js`.
- For UI against a local API, set `VITE_API_BASE_URL=http://localhost:3000` (restart Vite after changing).
- Start backend: `cd frontend/backend && npm run dev` (default port `3000`, health: `GET /health`).
- Start Vite: `cd frontend && npm run dev` (default `http://localhost:5173`).
- Production build (matches Render): `cd frontend && npm install --include=dev && npm run build:prod`, then `cd frontend/backend && npm install`.
- No root `npm test` / `npm run lint` scripts; verify with `npm run build` in `frontend` and API smoke tests (`/health`, `POST /auth/register`, `POST /auth/login`).
