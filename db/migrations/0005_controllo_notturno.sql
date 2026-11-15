-- 0005: controllo notturno delle fonti con la "via di mezzo" (CLAUDE.md, "Controllo notturno", 2026-11-15).

-- Stato di ogni fonte dopo l'ultimo controllo.
alter table sources
  -- Righe della pagina che contano (prezzi, distanze, iscrizioni), già ripulite: si confrontano notte per notte.
  add column testo_utile text,
  -- Un link si dichiara rotto solo dopo più notti di errori, non al primo intoppo.
  add column errori_consecutivi integer not null default 0 check (errori_consecutivi >= 0),
  add column esito text
    check (esito in ('prima_volta', 'invariata', 'cambiata', 'errore', 'non_controllabile', 'vietata_da_robots')),
  -- Ultima volta che il controllo ha confermato da solo i prezzi di questa fonte.
  add column ultima_conferma timestamptz;

-- Conferma automatica, separata dalla verifica fatta da una persona (data_rilevazione), che non viene mai
-- sovrascritta: annullare la conferma vuol dire solo svuotare questa colonna.
alter table prices
  add column confermato_il date;

-- Una sola voce aperta per fonte e tipo: un nuovo cambiamento aggiorna la voce, non ne aggiunge un'altra.
create unique index review_queue_fonte_aperta_idx
  on review_queue (source_id, origine)
  where stato = 'aperta' and origine in ('cambio_fonte', 'link_rotto');

-- Registro delle notti di controllo (anche quelle di prova, che non scrivono né dati né coda).
create table controlli_notturni (
  id          bigint generated always as identity primary key,
  iniziato_il timestamptz not null default now(),
  finito_il   timestamptz,
  prova       boolean not null,
  riepilogo   jsonb
);
