-- 0003: Postgres diventa l'unica fonte dei dati (decisione del 2026-11-13). Qui arrivano le colonne
-- delle fonti che finora stavano solo in data/gare.csv, così nel passaggio non si perde nulla.

-- Pagina che prova le edizioni passate (classifiche, albo d'oro): una per gara.
alter table races
  add column fonte_storico_url text check (fonte_storico_url ~ '^https?://');

-- Fonti integrative della distanza (percorso, km e D+), oltre a quella del prezzo.
alter table distances
  add column altre_fonti_url text[] not null default '{}';

-- Tipo della fonte del prezzo, come dichiarato nella ricerca (es. "primaria ufficiale",
-- "primaria ufficiale (2026: copia d'archivio della pagina ufficiale)"). La landing pubblica solo "primaria...".
alter table prices
  add column fonte_tipo text;

-- Una sola proposta aperta per la stessa gara o distanza nuova: ricaricare non crea doppioni.
create unique index review_queue_nuova_gara_aperta_idx
  on review_queue ((proposta ->> 'chiave'))
  where origine = 'nuova_gara' and stato = 'aperta';
