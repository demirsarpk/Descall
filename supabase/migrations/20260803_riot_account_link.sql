-- Riot / Valorant account linking for Descall profiles + LFG
CREATE TABLE IF NOT EXISTS user_riot_accounts (
  user_id UUID PRIMARY KEY,
  puuid TEXT,
  game_name TEXT NOT NULL,
  tag_line TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'eu',
  rank_tier TEXT,
  rank_rr INTEGER,
  rank_verified BOOLEAN NOT NULL DEFAULT false,
  link_method TEXT NOT NULL DEFAULT 'riot_id', -- riot_id | rso
  card_public BOOLEAN NOT NULL DEFAULT true,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_riot_puuid
  ON user_riot_accounts (puuid)
  WHERE puuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_riot_name_tag
  ON user_riot_accounts (lower(game_name), lower(tag_line));

CREATE INDEX IF NOT EXISTS idx_user_riot_rank ON user_riot_accounts (rank_tier);
