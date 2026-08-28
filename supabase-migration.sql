-- ============================================================================
-- GeoGiardini 2.0 — Migrazione schema per NUOVO progetto Supabase
-- Progetto: vxzfefccmafswydzrxao
-- Eseguire UNA SOLA VOLTA nel SQL Editor del nuovo progetto (Supabase Dashboard)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) CLIENTI: colonne mancanti (ruolo è indispensabile per il login)
-- ---------------------------------------------------------------------------
alter table clienti
  add column if not exists privato boolean not null default false,
  add column if not exists created_by text,
  add column if not exists ruolo text not null default 'contatto';

-- ---------------------------------------------------------------------------
-- 2) CATEGORIE: tabella mancante
-- ---------------------------------------------------------------------------
create table if not exists categorie (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) ATTIVITA: la tabella attuale usa "description", l'app usa "descrizione"
--    (rinomina la colonna preservando i dati) + aggiunge categoria_id e nota
-- ---------------------------------------------------------------------------
alter table attivita rename column description to descrizione;
alter table attivita
  add column if not exists categoria_id uuid references categorie(id) on delete set null,
  add column if not exists nota text;

-- ---------------------------------------------------------------------------
-- 4) LOCALITA: tabella mancante
-- ---------------------------------------------------------------------------
create table if not exists localita (
  id uuid primary key default gen_random_uuid(),
  localita text not null,
  note text,
  cliente_id uuid references clienti(id) on delete set null,
  privata boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5) INSERIMENTI_ATTIVITA: tabella principale (attività/planning)
-- ---------------------------------------------------------------------------
create table if not exists inserimenti_attivita (
  id uuid primary key default gen_random_uuid(),
  data_inizio date,
  data_fine date,
  localita_id uuid references localita(id) on delete set null,
  attivita_id uuid references attivita(id) on delete set null,
  note text,
  cliente_id uuid references clienti(id) on delete set null,
  giardiniere_ids jsonb not null default '[]'::jsonb,
  visibile boolean not null default false,
  aggiungi_al_planning boolean not null default true,
  stato text not null default 'promemoria' check (stato in ('promemoria','confermato','eseguito')),
  privato boolean not null default false,
  visibile_giardiniere boolean not null default true,
  visibile_contatto boolean not null default true,
  eseguito boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6) FOTO_ATTIVITA: tabella mancante
-- ---------------------------------------------------------------------------
create table if not exists foto_attivita (
  id uuid primary key default gen_random_uuid(),
  attivita_id uuid not null references inserimenti_attivita(id) on delete cascade,
  foto_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7) NOTIFICHE_ATTIVITA: tabella mancante
-- ---------------------------------------------------------------------------
create table if not exists notifiche_attivita (
  id uuid primary key default gen_random_uuid(),
  attivita_id uuid not null references inserimenti_attivita(id) on delete cascade,
  letta boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8) PUSH_SUBSCRIPTIONS: colonne mancanti per le notifiche push (web + FCM)
-- ---------------------------------------------------------------------------
alter table push_subscriptions
  add column if not exists p256dh text,
  add column if not exists auth text,
  add column if not exists fcm_token text,
  add column if not exists platform text not null default 'web',
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 9) LAVORI + DESCRIZIONI_LAVORO: pagina Cliente (legacy)
-- ---------------------------------------------------------------------------
create table if not exists descrizioni_lavoro (
  id uuid primary key default gen_random_uuid(),
  descrizione text not null
);
create table if not exists lavori (
  id uuid primary key default gen_random_uuid(),
  id_cliente uuid references clienti(id) on delete cascade,
  data timestamptz,
  descrizione_id uuid references descrizioni_lavoro(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10) INDICI utili
-- ---------------------------------------------------------------------------
create index if not exists idx_inserimenti_data      on inserimenti_attivita (data_inizio);
create index if not exists idx_inserimenti_localita  on inserimenti_attivita (localita_id);
create index if not exists idx_inserimenti_attivita  on inserimenti_attivita (attivita_id);
create index if not exists idx_foto_attivita         on foto_attivita (attivita_id);
create index if not exists idx_notifiche_attivita    on notifiche_attivita (attivita_id);
create index if not exists idx_push_endpoint         on push_subscriptions (endpoint);

-- ---------------------------------------------------------------------------
-- 11) RLS: l'app usa la anon key per leggere/scrivere.
--     Disabilita Row Level Security su tutte le tabelle dell'app
--     (coerente con il fatto che le letture anon già funzionano).
-- ---------------------------------------------------------------------------
alter table clienti                disable row level security;
alter table categorie              disable row level security;
alter table attivita               disable row level security;
alter table localita               disable row level security;
alter table inserimenti_attivita   disable row level security;
alter table foto_attivita          disable row level security;
alter table notifiche_attivita     disable row level security;
alter table push_subscriptions     disable row level security;
alter table giardinieri            disable row level security;
alter table appuntamenti           disable row level security;
alter table appuntamenti_attivita  disable row level security;
alter table appuntamenti_giardinieri disable row level security;
alter table notifiche              disable row level security;
alter table lavori                 disable row level security;
alter table descrizioni_lavoro     disable row level security;

-- ---------------------------------------------------------------------------
-- 12) STORAGE: bucket "foto" pubblico + policies
--     (necessario per upload/visualizzazione foto)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('foto', 'foto', true)
on conflict (id) do update set public = true;

drop policy if exists "foto public select" on storage.objects;
create policy "foto public select" on storage.objects
  for select using (bucket_id = 'foto');

drop policy if exists "foto public insert" on storage.objects;
create policy "foto public insert" on storage.objects
  for insert with check (bucket_id = 'foto');

drop policy if exists "foto public update" on storage.objects;
create policy "foto public update" on storage.objects
  for update using (bucket_id = 'foto');

drop policy if exists "foto public delete" on storage.objects;
create policy "foto public delete" on storage.objects
  for delete using (bucket_id = 'foto');

-- ---------------------------------------------------------------------------
-- 13) FIX: tabella legacy "notifiche_esecuzioni" (NON usata dall'app)
--     I suoi vincoli FK bloccano l'eliminazione di clienti/notifiche a cascata.
--     Rimuove TUTTI i vincoli di chiave esterna della tabella.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'notifiche_esecuzioni'::regclass
      and contype = 'f'
  loop
    execute format('alter table notifiche_esecuzioni drop constraint %I', r.conname);
  end loop;
end $$;
