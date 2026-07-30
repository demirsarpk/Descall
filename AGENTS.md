# AGENTS.md

## Cursor Cloud specific instructions

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
- **Download page** is Windows-only; `.exe` URL comes from GitHub `releases/latest` (`demirrsarppkurtlarr/Descall`). CI publishes `Descall-Setup-*.exe` on version tags.
- **Client errors** POST to `/api/errors` (mounted in `server.js`). `/debug/*` routes are disabled in production unless `ENABLE_DEBUG_ROUTES=true`.
- **Bans** persist in `users.is_banned` (migration `20250730_add_users_is_banned.sql`); loaded on server boot into `bannedUserIds`.

### Auth / services
- Custom JWT + Supabase DB/storage (service role). See `README.md` / `frontend/package.json` for run scripts.
