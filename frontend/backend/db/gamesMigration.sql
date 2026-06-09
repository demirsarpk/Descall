-- Blackjack ve oyun sistemi için migration
-- Bu migration user_credits tablosu ve gerekli alanları ekler

-- User credits tablosu (oyun parası/bakiye)
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  credits INTEGER DEFAULT 1000, -- Başlangıç bakiyesi
  total_won INTEGER DEFAULT 0,
  total_lost INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Oyun geçmişi tablosu
CREATE TABLE IF NOT EXISTS game_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'blackjack',
  group_id TEXT,
  bet_amount INTEGER NOT NULL,
  result TEXT NOT NULL, -- 'win', 'loss', 'push', 'blackjack'
  win_amount INTEGER DEFAULT 0,
  player_hand JSONB,
  dealer_hand JSONB,
  played_at TIMESTAMP DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_group_id ON game_history(group_id);
CREATE INDEX IF NOT EXISTS idx_game_history_played_at ON game_history(played_at);

-- RLS policies (opsiyonel, servis rolü kullanıyorsanız kaldırabilirsiniz)
-- ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

-- Otomatik bakiye atama fonksiyonu (yeni kullanıcılar için)
CREATE OR REPLACE FUNCTION ensure_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits)
  VALUES (NEW.id, 1000)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eğer users tablosu varsa trigger ekle (opsiyonel)
-- DROP TRIGGER IF EXISTS ensure_credits_on_user_create ON users;
-- CREATE TRIGGER ensure_credits_on_user_create
--   AFTER INSERT ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION ensure_user_credits();

-- Örnek: Tüm mevcut kullanıcılara bakiye ata (manuel çalıştırın)
-- INSERT INTO user_credits (user_id, credits)
-- SELECT id, 1000 FROM users
-- ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE user_credits IS 'Kullanıcı oyun bakiyeleri';
COMMENT ON TABLE game_history IS 'Oyun geçmişi kayıtları';
