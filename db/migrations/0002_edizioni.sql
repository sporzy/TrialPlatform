-- 0002: edizioni (date gara e iscrizioni), scaglioni datati, fonti monitorate e coda di revisione.
-- Postgres standard. I valori ammessi nei CHECK sono gli stessi di src/lib/tipi.ts.
-- Le date sono tutte facoltative: null = non ancora annunciata o non verificata.
-- Lo stato delle iscrizioni non si salva: si calcola dalle date (src/lib/calendario.ts).
-- Niente begin/commit: lo script di migrazione esegue ogni file in una transazione.

-- Un'edizione è una gara in un anno. Le date sono dell'evento, non delle singole distanze.
create table editions (
  id                   bigint generated always as identity primary key,
  race_id              text not null references races (id) on delete cascade,
  anno                 smallint not null check (anno between 1900 and 2100),
  data_gara            date,
  -- solo per le gare su più giorni
  data_gara_fine       date,
  iscrizioni_apertura  date,
  iscrizioni_chiusura  date,
  lotteria_apertura    date,
  lotteria_chiusura    date,
  lotteria_esito       date,
  -- pagina d'iscrizione di questa edizione (spesso una piattaforma esterna, cambia di anno in anno)
  url_iscrizione       text check (url_iscrizione ~ '^https://'),
  posti_max            integer check (posti_max > 0),
  -- impostato solo da una fonte, mai dedotto
  stato_manuale        text check (stato_manuale in ('sold_out', 'annullata', 'rinviata')),
  fonte_url            text,
  data_verifica        date,
  created_at           timestamptz not null default now(),
  unique (race_id, anno),
  check (data_gara_fine is null or data_gara is not null),
  check (data_gara_fine >= data_gara),
  check (iscrizioni_chiusura >= iscrizioni_apertura),
  check (lotteria_chiusura >= lotteria_apertura),
  check (lotteria_esito >= lotteria_chiusura)
);

-- Scaglioni con validità: il prezzo attuale cambia da solo con la data.
-- `ordine` distingue più scaglioni con lo stesso nome (early 1, early 2).
-- `fino_a_iscritti`: scaglione a numero di partecipanti, non calcolabile senza una fonte.
alter table prices
  add column valido_dal      date,
  add column valido_fino     date,
  add column fino_a_iscritti integer check (fino_a_iscritti > 0),
  add column ordine          smallint not null default 1 check (ordine >= 1),
  add check (valido_fino >= valido_dal),
  drop constraint prices_distance_id_edizione_scaglione_key,
  add unique (distance_id, edizione, scaglione, ordine);

-- Pagine e PDF ufficiali controllati dal job notturno.
create table sources (
  id                 bigint generated always as identity primary key,
  race_id            text not null references races (id) on delete cascade,
  url                text not null check (url ~ '^https?://'),
  formato            text not null check (formato in ('pagina', 'pdf')),
  ultimo_hash        text,
  ultimo_controllo   timestamptz,
  ultimo_cambiamento timestamptz,
  -- ultimo errore (404, timeout, redirect verso un altro dominio); null se l'ultimo controllo è andato bene
  errore             text,
  created_at         timestamptz not null default now(),
  unique (race_id, url)
);

-- Tutto ciò che va approvato da una persona prima di essere pubblicato.
create table review_queue (
  id         bigint generated always as identity primary key,
  origine    text not null
             check (origine in ('cambio_fonte', 'link_rotto', 'nuova_gara', 'segnalazione')),
  race_id    text references races (id) on delete set null,
  source_id  bigint references sources (id) on delete set null,
  diff_testo text,
  -- valori proposti, ognuno con la citazione esatta dalla fonte
  proposta   jsonb,
  stato      text not null default 'aperta'
             check (stato in ('aperta', 'approvata', 'scartata')),
  creato_il  timestamptz not null default now(),
  chiuso_il  timestamptz,
  check ((stato = 'aperta') = (chiuso_il is null))
);

create index review_queue_aperte_idx on review_queue (creato_il) where stato = 'aperta';
