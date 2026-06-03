-- Descall Guild/Server System Migration
-- Run this in Supabase SQL Editor before deploying guild features

-- Guilds (servers)
CREATE TABLE IF NOT EXISTS public.guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Guild members
CREATE TABLE IF NOT EXISTS public.guild_members (
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nickname TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);

-- Guild channels (text, voice, category)
CREATE TABLE IF NOT EXISTS public.guild_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice', 'category')),
  position INTEGER DEFAULT 0,
  parent_id UUID REFERENCES public.guild_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guild invites
CREATE TABLE IF NOT EXISTS public.guild_invites (
  code TEXT PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  max_uses INTEGER,
  uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guilds_owner ON public.guilds(owner_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_user ON public.guild_members(user_id);
CREATE INDEX IF NOT EXISTS idx_guild_channels_guild ON public.guild_channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_invites_guild ON public.guild_invites(guild_id);

-- Enable RLS
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies (service_role bypasses these)
CREATE POLICY guilds_select ON public.guilds FOR SELECT USING (true);
CREATE POLICY guild_members_select ON public.guild_members FOR SELECT USING (true);
CREATE POLICY guild_channels_select ON public.guild_channels FOR SELECT USING (true);
CREATE POLICY guild_invites_select ON public.guild_invites FOR SELECT USING (true);
