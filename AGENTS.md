# AGENTS.md

## Cursor Cloud specific instructions

### Voice / group calls
- DM calls signal with `call:offer` → accept/reject UI is `CallOverlay` (`mode === "incoming"`).
- Group calls signal with `group:call:incoming` → accept/reject UI is `GroupCallIncomingModal`.
- Backend delivery uses Socket.IO `user:${userId}` rooms (not presence-map-only). Presence is kept if another tab stays connected.
- `useGroupCall(socket, currentUserId)` needs the logged-in user id — `socket.user` is **not** set on the client.
- After loading groups, always emit `groups:rejoin` so members are in group rooms for banners/fallback invites.
- Group start looks up `group_members` in DB when client `memberIds` is empty.

### Auth / services
- Custom JWT + Supabase DB/storage (service role). See `README.md` / `frontend/package.json` for run scripts.
