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
