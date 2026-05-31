-- =============================================================
-- Descall Migration v2
-- Run this in Supabase SQL Editor (safe to re-run, uses IF NOT EXISTS / DO blocks)
-- =============================================================

-- ─── 1. USERS — add all missing profile & settings columns ───

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio                TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_status      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_density         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bubble_style       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin           BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status             TEXT DEFAULT 'offline';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen          TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sound_enabled      BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sound_volume       INTEGER DEFAULT 80;
ALTER TABLE users ADD COLUMN IF NOT EXISTS desktop_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS call_notifications    BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mention_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMP DEFAULT NOW();

-- ─── 2. DM MESSAGES — persist direct messages ───────────────

CREATE TABLE IF NOT EXISTS dm_messages (
  id            UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id  UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT,
  media_url     TEXT,
  media_type    TEXT,
  mime_type     TEXT,
  file_size     BIGINT,
  original_name TEXT,
  delivered_at  TIMESTAMP,
  read_at       TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_from   ON dm_messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_to     ON dm_messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conv   ON dm_messages(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_time   ON dm_messages(created_at DESC);

ALTER TABLE dm_messages DISABLE ROW LEVEL SECURITY;

-- ─── 3. GROUP MESSAGES — add missing indexes & message_type col ─

ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
-- message_type: 'text' | 'media' | 'call_summary'

CREATE INDEX IF NOT EXISTS idx_group_messages_type ON group_messages(message_type);

-- ─── 4. CALL SUMMARIES — persistent record when a call ends ──

-- Drop and recreate with correct schema (was partial before)
-- group_calls already exists from migration v1, expand it:
ALTER TABLE group_calls ADD COLUMN IF NOT EXISTS ended_by          UUID;
ALTER TABLE group_calls ADD COLUMN IF NOT EXISTS call_type         TEXT;  -- already might exist, safe
ALTER TABLE group_calls ADD COLUMN IF NOT EXISTS duration_seconds  INTEGER;
ALTER TABLE group_calls ADD COLUMN IF NOT EXISTS participant_count INTEGER;
ALTER TABLE group_calls ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'active';
-- status: 'active' | 'ended'

CREATE INDEX IF NOT EXISTS idx_group_calls_group    ON group_calls(group_id);
CREATE INDEX IF NOT EXISTS idx_group_calls_status   ON group_calls(status);
CREATE INDEX IF NOT EXISTS idx_group_calls_started  ON group_calls(started_at DESC);

ALTER TABLE group_calls DISABLE ROW LEVEL SECURITY;

-- group_call_participants already exists, add left_at if missing:
ALTER TABLE group_call_participants ADD COLUMN IF NOT EXISTS left_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_gcp_call   ON group_call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_gcp_user   ON group_call_participants(user_id);

ALTER TABLE group_call_participants DISABLE ROW LEVEL SECURITY;

-- ─── 5. DM CALL LOGS — persist 1-on-1 voice/video call history ─

CREATE TABLE IF NOT EXISTS dm_calls (
  id               UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id        UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id        UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type        TEXT      NOT NULL,   -- 'voice' | 'video'
  status           TEXT      NOT NULL,   -- 'completed' | 'missed' | 'declined' | 'cancelled'
  started_at       TIMESTAMP,
  ended_at         TIMESTAMP,
  duration_seconds INTEGER,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_calls_caller  ON dm_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_dm_calls_callee  ON dm_calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_dm_calls_time    ON dm_calls(created_at DESC);

ALTER TABLE dm_calls DISABLE ROW LEVEL SECURITY;

-- ─── 6. RAISE HAND EVENTS — log every hand raise/lower in calls ─

CREATE TABLE IF NOT EXISTS call_hand_raises (
  id          UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id     UUID,                          -- NULL for DM calls
  group_id    UUID,                          -- NULL for DM calls
  user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raised_at   TIMESTAMP DEFAULT NOW(),
  lowered_at  TIMESTAMP,
  call_type   TEXT      NOT NULL            -- 'group' | 'dm'
);

CREATE INDEX IF NOT EXISTS idx_hand_raises_call   ON call_hand_raises(call_id);
CREATE INDEX IF NOT EXISTS idx_hand_raises_user   ON call_hand_raises(user_id);
CREATE INDEX IF NOT EXISTS idx_hand_raises_group  ON call_hand_raises(group_id);

ALTER TABLE call_hand_raises DISABLE ROW LEVEL SECURITY;

-- ─── 7. CALL SUMMARY MESSAGES — persisted chat bubbles ────────
-- These are group_messages with message_type = 'call_summary'
-- and content = JSON serialized summary. No new table needed.
-- The group:call:summary socket event already emits the summary;
-- backend will INSERT it as a group_message with message_type='call_summary'.

-- ─── 8. SCREEN SHARE SESSIONS — track who shared what when ───

CREATE TABLE IF NOT EXISTS screen_share_sessions (
  id           UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id      UUID,
  group_id     UUID      NOT NULL,
  user_id      UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at   TIMESTAMP DEFAULT NOW(),
  ended_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_screen_share_call  ON screen_share_sessions(call_id);
CREATE INDEX IF NOT EXISTS idx_screen_share_group ON screen_share_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_screen_share_user  ON screen_share_sessions(user_id);

ALTER TABLE screen_share_sessions DISABLE ROW LEVEL SECURITY;

-- ─── 9. FRIENDS / FRIENDSHIPS ─────────────────────────────────
-- (may already exist via runtime; persist for durability)

CREATE TABLE IF NOT EXISTS friendships (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending',  -- 'pending' | 'accepted' | 'declined'
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to   ON friend_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user     ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend   ON friendships(friend_id);

ALTER TABLE friendships     DISABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

-- ─── 10. NOTIFICATIONS — persist notifications ────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT      NOT NULL,  -- 'friend_request' | 'friend_accepted' | 'group_invite' | 'mention'
  payload    JSONB     DEFAULT '{}',
  read_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, read_at) WHERE read_at IS NULL;

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ─── 11. ANNOUNCEMENTS — add rich fields ─────────────────────

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS emoji   TEXT    DEFAULT '📢';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS pinned  BOOLEAN DEFAULT FALSE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target  TEXT    DEFAULT 'all';  -- 'all' | 'online' | 'admins'
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author  TEXT;

CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(pinned DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);

-- ─── DONE ─────────────────────────────────────────────────────
