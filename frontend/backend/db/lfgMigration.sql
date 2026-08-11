-- Valorant LFG (copy for backend/db convenience)
CREATE TABLE IF NOT EXISTS lfg_lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  game TEXT NOT NULL DEFAULT 'valorant',
  mode TEXT NOT NULL DEFAULT 'competitive',
  region TEXT NOT NULL DEFAULT 'eu',
  party_size_current INTEGER NOT NULL DEFAULT 1,
  party_size_max INTEGER NOT NULL DEFAULT 5,
  host_rank TEXT NOT NULL,
  host_rank_index INTEGER NOT NULL DEFAULT 0,
  rank_min TEXT NOT NULL,
  rank_max TEXT NOT NULL,
  rank_min_index INTEGER NOT NULL DEFAULT 0,
  rank_max_index INTEGER NOT NULL DEFAULT 0,
  need_roles TEXT[] DEFAULT '{}',
  mic_required BOOLEAN NOT NULL DEFAULT false,
  party_code TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '45 minutes'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lfg_lobbies_open
  ON lfg_lobbies (status, mode, rank_min_index, rank_max_index, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lfg_lobbies_host ON lfg_lobbies (host_id);
CREATE INDEX IF NOT EXISTS idx_lfg_lobbies_group ON lfg_lobbies (group_id);

CREATE TABLE IF NOT EXISTS lfg_lobby_members (
  lobby_id UUID NOT NULL REFERENCES lfg_lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rank_snapshot TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lobby_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lfg_lobby_members_user ON lfg_lobby_members (user_id);

CREATE TABLE IF NOT EXISTS lfg_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_id UUID,
  lobby_id UUID REFERENCES lfg_lobbies(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
