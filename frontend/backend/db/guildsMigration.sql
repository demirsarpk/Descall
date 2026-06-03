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

-- Guild messages (text channel messages)
CREATE TABLE IF NOT EXISTS public.guild_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.guild_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  reply_to UUID REFERENCES public.guild_messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guild message reactions
CREATE TABLE IF NOT EXISTS public.guild_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.guild_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Guild message reads (read receipts per channel)
CREATE TABLE IF NOT EXISTS public.guild_message_reads (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.guild_channels(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.guild_messages(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guilds_owner ON public.guilds(owner_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_user ON public.guild_members(user_id);
CREATE INDEX IF NOT EXISTS idx_guild_channels_guild ON public.guild_channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_invites_guild ON public.guild_invites(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_messages_channel ON public.guild_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_guild_messages_guild ON public.guild_messages(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_messages_created ON public.guild_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_guild_reactions_message ON public.guild_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_guild_reads_channel ON public.guild_message_reads(channel_id);

-- Enable RLS
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_invites ENABLE ROW LEVEL SECURITY;

-- Enable RLS for new tables
ALTER TABLE public.guild_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS policies (service_role bypasses these)
DROP POLICY IF EXISTS guilds_select ON public.guilds;
CREATE POLICY guilds_select ON public.guilds FOR SELECT USING (true);
DROP POLICY IF EXISTS guilds_insert ON public.guilds;
CREATE POLICY guilds_insert ON public.guilds FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS guilds_update ON public.guilds;
CREATE POLICY guilds_update ON public.guilds FOR UPDATE USING (true);
DROP POLICY IF EXISTS guilds_delete ON public.guilds;
CREATE POLICY guilds_delete ON public.guilds FOR DELETE USING (true);

DROP POLICY IF EXISTS guild_members_select ON public.guild_members;
CREATE POLICY guild_members_select ON public.guild_members FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_members_insert ON public.guild_members;
CREATE POLICY guild_members_insert ON public.guild_members FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS guild_members_update ON public.guild_members;
CREATE POLICY guild_members_update ON public.guild_members FOR UPDATE USING (true);
DROP POLICY IF EXISTS guild_members_delete ON public.guild_members;
CREATE POLICY guild_members_delete ON public.guild_members FOR DELETE USING (true);

DROP POLICY IF EXISTS guild_channels_select ON public.guild_channels;
CREATE POLICY guild_channels_select ON public.guild_channels FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_channels_insert ON public.guild_channels;
CREATE POLICY guild_channels_insert ON public.guild_channels FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS guild_channels_update ON public.guild_channels;
CREATE POLICY guild_channels_update ON public.guild_channels FOR UPDATE USING (true);
DROP POLICY IF EXISTS guild_channels_delete ON public.guild_channels;
CREATE POLICY guild_channels_delete ON public.guild_channels FOR DELETE USING (true);

DROP POLICY IF EXISTS guild_invites_select ON public.guild_invites;
CREATE POLICY guild_invites_select ON public.guild_invites FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_invites_insert ON public.guild_invites;
CREATE POLICY guild_invites_insert ON public.guild_invites FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS guild_invites_update ON public.guild_invites;
CREATE POLICY guild_invites_update ON public.guild_invites FOR UPDATE USING (true);
DROP POLICY IF EXISTS guild_invites_delete ON public.guild_invites;
CREATE POLICY guild_invites_delete ON public.guild_invites FOR DELETE USING (true);

DROP POLICY IF EXISTS guild_messages_select ON public.guild_messages;
CREATE POLICY guild_messages_select ON public.guild_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_messages_insert ON public.guild_messages;
CREATE POLICY guild_messages_insert ON public.guild_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS guild_messages_update ON public.guild_messages;
CREATE POLICY guild_messages_update ON public.guild_messages FOR UPDATE USING (true);
DROP POLICY IF EXISTS guild_messages_delete ON public.guild_messages;
CREATE POLICY guild_messages_delete ON public.guild_messages FOR DELETE USING (true);

DROP POLICY IF EXISTS guild_reactions_select ON public.guild_message_reactions;
CREATE POLICY guild_reactions_select ON public.guild_message_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_reactions_insert ON public.guild_message_reactions;
CREATE POLICY guild_reactions_insert ON public.guild_message_reactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS guild_reactions_delete ON public.guild_message_reactions;
CREATE POLICY guild_reactions_delete ON public.guild_message_reactions FOR DELETE USING (true);

DROP POLICY IF EXISTS guild_reads_select ON public.guild_message_reads;
CREATE POLICY guild_reads_select ON public.guild_message_reads FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_reads_insert ON public.guild_message_reads;
CREATE POLICY guild_reads_insert ON public.guild_message_reads FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS guild_reads_update ON public.guild_message_reads;
CREATE POLICY guild_reads_update ON public.guild_message_reads FOR UPDATE USING (true);
