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
- Prefer **browser tab** capture (`displaySurface: "browser"`, soft `ideal` constraints only). Hard `max` post-capture constraints can kill DRM tracks (Netflix black / auto-stop).
- Group leave removes **only that user**; room stays open while ≥1 participant remains. Socket disconnect must not drop call membership if another tab for the same user is still connected.
- Incoming call card is centered with `left/right + margin` — never CSS `translateX(-50%)` (Framer Motion owns `transform`).
- Chat/banner join: `participant-joined` must still send an offer even if `startGroupCall` pre-created the PC (`useGroupCall.js`).
- **Screen quality UI** lives in `CallOverlay` via `ScreenShareQualityPanel` (DM + group). Changing quality while sharing restarts capture safely.
- **ICE/TURN**: client preloads `GET /api/webrtc/ice-config` (`src/lib/iceConfig.js`). Set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` on the backend (or `VITE_ICE_SERVERS` JSON on the frontend). Manual call checks: `docs/CALL_TEST_MATRIX.md`.
- **Download page** loads the desktop version from GitHub **`releases/latest`** via `GET /api/app/latest-release` (repo: `demirrsarppkurtlarr/Descall`). Bump semver with `frontend/electron/release.cjs` (`patch` / `minor` / `major`). See `docs/ELECTRON_RELEASE.md`.
- **Client errors** POST to `/api/errors` (mounted in `server.js`). `/debug/*` routes are disabled in production unless `ENABLE_DEBUG_ROUTES=true`.
- **Bans** persist in `users.is_banned` (migration `20250730_add_users_is_banned.sql`); loaded on server boot into `bannedUserIds`.

### Services
- Backend: `frontend/backend` (Express + Socket.IO). Frontend Vite app is served from backend `dist` in production; local UI via Vite. See `README.md` / `frontend/package.json` scripts.
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (required); `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` (optional until OAuth is enabled).

### Valorant / Riot account link
- Users link Valorant from **Settings → My Account** with **Name#TAG only**. Rank + Riot ID appear on profile/hover/LFG **only after a successful link**.
- **Real rank requires `HENRIK_API_KEY`** on Render (HenrikDev dashboard / Discord). Without it, link returns 503 Unauthorized — staging logs show `[Riot] MMR lookup: Unauthorized`.
- Lookup uses Henrik MMR v3 (`/valorant/v3/mmr/{region}/pc/{name}/{tag}`) with v2 fallback; region auto-detect from account when possible.
- SQL: `supabase/migrations/20260803_riot_account_link.sql` → `user_riot_accounts`. Routes: `/riot` + `/api/riot`. Public card on `GET /auth/me` / `GET /auth/users/:id` as `user.valorant`.
