-- 0001: gare, distanze, storico prezzi e costi nascosti (CLAUDE.md, "Modello dati").
-- Postgres standard. I valori ammessi nei CHECK sono gli stessi di src/lib/tipi.ts.
-- Il prezzo non è un campo della gara: è uno storico per distanza, edizione e scaglione.
-- Utenti, partecipazioni e recensioni arriveranno con il login (Auth.js).
-- Niente begin/commit: lo script di migrazione esegue ogni file in una transazione.

create table races (
  id             text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome           text not null,
  paese          text not null check (paese ~ '^[A-Z]{2}$'),
  regione        text,
  organizzatore  text,
  sito           text,
  categoria      text not null
                 check (categoria in ('piccola', 'grande_circuito', 'fell_race', 'club')),
  qualifica_utmb boolean not null default false,
  itra           smallint check (itra >= 0),
  created_at     timestamptz not null default now(),
  unique (paese, nome)
);

create table distances (
  id                     text primary key check (id ~ '^[a-z0-9]+(-{1,2}[a-z0-9]+)*$'),
  race_id                text not null references races (id) on delete cascade,
  nome                   text not null,
  km                     numeric(6, 2) not null check (km > 0),
  dplus                  integer not null check (dplus >= 0),
  cancelli               text,
  materiale_obbligatorio text,
  gpx_url                text,
  riferimento_nazionale  boolean not null default false,
  note                   text,
  created_at             timestamptz not null default now(),
  unique (race_id, nome)
);

create table prices (
  id                  bigint generated always as identity primary key,
  distance_id         text not null references distances (id) on delete cascade,
  edizione            smallint not null check (edizione between 1900 and 2100),
  prezzo              numeric(10, 2) not null check (prezzo >= 0),
  valuta              text not null check (valuta ~ '^[A-Z]{3}$'),
  scaglione           text not null
                      check (scaglione in ('early', 'standard', 'last', 'lotteria')),
  -- null = non verificato
  include_iva         boolean,
  include_commissioni boolean,
  fonte_url           text,
  data_rilevazione    date,
  created_at          timestamptz not null default now(),
  unique (distance_id, edizione, scaglione)
);

create table hidden_costs (
  id          bigint generated always as identity primary key,
  race_id     text not null references races (id) on delete cascade,
  tipo        text not null
              check (tipo in ('tesseramento', 'crew', 'requisito_indice', 'navetta', 'alloggio')),
  descrizione text not null,
  -- null se il costo non ha un importo fisso (es. crew obbligatoria)
  importo     numeric(10, 2) check (importo >= 0),
  valuta      text check (valuta ~ '^[A-Z]{3}$'),
  created_at  timestamptz not null default now(),
  check ((importo is null) = (valuta is null))
);

create index hidden_costs_race_id_idx on hidden_costs (race_id);
