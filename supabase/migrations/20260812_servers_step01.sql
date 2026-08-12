-- Descall Servers Step 0+1: drop legacy guilds, create servers schema.
-- See frontend/backend/db/serversMigration.sql for full comments.

DROP TABLE IF EXISTS public.guild_message_reads CASCADE;
DROP TABLE IF EXISTS public.guild_message_reactions CASCADE;
DROP TABLE IF EXISTS public.guild_messages CASCADE;
DROP TABLE IF EXISTS public.guild_invites CASCADE;
DROP TABLE IF EXISTS public.guild_channels CASCADE;
DROP TABLE IF EXISTS public.guild_members CASCADE;
DROP TABLE IF EXISTS public.guilds CASCADE;

CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  icon_url TEXT,
  banner_url TEXT,
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vanity_slug TEXT UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON public.servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_public ON public.servers(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_servers_vanity ON public.servers(vanity_slug) WHERE vanity_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.server_members (
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nickname TEXT CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 32),
  list_position INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_user ON public.server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server ON public.server_members(server_id);

CREATE TABLE IF NOT EXISTS public.server_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  color INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  permissions BIGINT NOT NULL DEFAULT 0,
  hoist BOOLEAN NOT NULL DEFAULT FALSE,
  mentionable BOOLEAN NOT NULL DEFAULT FALSE,
  is_everyone BOOLEAN NOT NULL DEFAULT FALSE,
  icon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_server_roles_everyone
  ON public.server_roles(server_id) WHERE is_everyone = TRUE;
CREATE INDEX IF NOT EXISTS idx_server_roles_server_pos
  ON public.server_roles(server_id, position DESC);

CREATE TABLE IF NOT EXISTS public.server_member_roles (
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.server_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_server_member_roles_user
  ON public.server_member_roles(user_id);

CREATE TABLE IF NOT EXISTS public.server_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  type TEXT NOT NULL CHECK (type IN ('text', 'voice', 'stage', 'category')),
  topic TEXT CHECK (topic IS NULL OR char_length(topic) <= 1024),
  position INTEGER NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES public.server_channels(id) ON DELETE SET NULL,
  slowmode_seconds INTEGER NOT NULL DEFAULT 0 CHECK (slowmode_seconds >= 0 AND slowmode_seconds <= 21600),
  nsfw BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_server_channels_server_pos
  ON public.server_channels(server_id, position);

CREATE TABLE IF NOT EXISTS public.server_channel_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.server_channels(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('role', 'member')),
  target_id UUID NOT NULL,
  allow_permissions BIGINT NOT NULL DEFAULT 0,
  deny_permissions BIGINT NOT NULL DEFAULT 0,
  UNIQUE (channel_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS public.server_invites (
  code TEXT PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.server_channels(id) ON DELETE SET NULL,
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0,
  max_age_seconds INTEGER CHECK (max_age_seconds IS NULL OR max_age_seconds > 0),
  temporary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_server_invites_server ON public.server_invites(server_id);

CREATE TABLE IF NOT EXISTS public.server_bans (
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.server_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  changes JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_server_audit_logs_server_created
  ON public.server_audit_logs(server_id, created_at DESC);
