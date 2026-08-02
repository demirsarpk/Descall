-- Ensure Blackjack casino tables exist (idempotent)

CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  credits INTEGER DEFAULT 1000,
  total_won INTEGER DEFAULT 0,
  total_lost INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'blackjack',
  group_id TEXT,
  bet_amount INTEGER NOT NULL,
  result TEXT NOT NULL,
  win_amount INTEGER DEFAULT 0,
  player_hand JSONB,
  dealer_hand JSONB,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits (user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON public.game_history (user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_group_id ON public.game_history (group_id);
CREATE INDEX IF NOT EXISTS idx_game_history_played_at ON public.game_history (played_at DESC);

COMMENT ON TABLE public.user_credits IS 'Casino bankroll for Blackjack and other chat games';
COMMENT ON TABLE public.game_history IS 'Finished blackjack hands';
