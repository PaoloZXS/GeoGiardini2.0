-- Crea tabella giardinieri
CREATE TABLE IF NOT EXISTS giardinieri (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  colore TEXT DEFAULT '#0b79d0',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crea tabella appuntamenti_giardinieri (junction)
CREATE TABLE IF NOT EXISTS appuntamenti_giardinieri (
  id BIGSERIAL PRIMARY KEY,
  appuntamento_id UUID REFERENCES appuntamenti(id) ON DELETE CASCADE,
  giardiniere_id BIGINT REFERENCES giardinieri(id) ON DELETE CASCADE,
  UNIQUE(appuntamento_id, giardiniere_id)
);

-- Crea tabella appuntamenti_attivita (junction) se non esiste
CREATE TABLE IF NOT EXISTS appuntamenti_attivita (
  id BIGSERIAL PRIMARY KEY,
  appuntamento_id UUID REFERENCES appuntamenti(id) ON DELETE CASCADE,
  attivita_id UUID REFERENCES attivita(id) ON DELETE CASCADE,
  UNIQUE(appuntamento_id, attivita_id)
);

-- Crea tabella notifiche se non esiste
CREATE TABLE IF NOT EXISTS notifiche (
  id BIGSERIAL PRIMARY KEY,
  appuntamento_id UUID REFERENCES appuntamenti(id) ON DELETE CASCADE,
  read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserisci giardinieri di default
INSERT INTO giardinieri (username, colore) VALUES
  ('Angelo', '#0b79d0'),
  ('Marco', '#27ae60'),
  ('Paolo', '#f39c12')
ON CONFLICT (username) DO NOTHING;

-- Aggiungi colonne a tabella clienti
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS privato BOOLEAN DEFAULT FALSE;
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS ruolo TEXT DEFAULT 'contatto';

ALTER TABLE inserimenti_attivita ADD COLUMN IF NOT EXISTS visibile_giardiniere BOOLEAN DEFAULT TRUE;
ALTER TABLE inserimenti_attivita ADD COLUMN IF NOT EXISTS visibile_contatto BOOLEAN DEFAULT TRUE;
ALTER TABLE inserimenti_attivita DROP COLUMN IF EXISTS giardiniere_id;
ALTER TABLE inserimenti_attivita ADD COLUMN IF NOT EXISTS giardiniere_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inserimenti_attivita ADD COLUMN IF NOT EXISTS eseguito BOOLEAN DEFAULT FALSE;

-- Aggiungi colonne a tabella localita
ALTER TABLE localita ADD COLUMN IF NOT EXISTS privata BOOLEAN DEFAULT FALSE;
ALTER TABLE localita ADD COLUMN IF NOT EXISTS created_by TEXT;

-- ============================================
-- NOTIFICHE PUSH (ispirato a CosaDaFare)
-- ============================================

-- Crea tabella push_subscriptions se non esiste
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT 'contatto',
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_group_name ON push_subscriptions(group_name);

-- Aggiungi group_name se la tabella esiste già (migrazione)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT 'contatto';
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- AGGIUNTE PER FCM (Android nativo / Capacitor)
-- ============================================

-- Rendi endpoint opzionale (per FCM) e aggiungi fcm_token + platform
ALTER TABLE push_subscriptions ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN keys DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN keys SET DEFAULT NULL;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';

-- Indice per lookup FCM
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token ON push_subscriptions(fcm_token);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform ON push_subscriptions(platform);
