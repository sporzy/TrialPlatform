-- 0004: la redazione in /admin/. Ogni voce chiusa della coda dice chi l'ha chiusa (email di Cloudflare Access),
-- e le correzioni fatte a mano dalla redazione restano registrate come voci "modifica_manuale" (con prima e dopo).

alter table review_queue
  add column chiuso_da text,
  add check (chiuso_da is null or stato <> 'aperta');

alter table review_queue drop constraint review_queue_origine_check;
alter table review_queue add constraint review_queue_origine_check
  check (origine in ('cambio_fonte', 'link_rotto', 'nuova_gara', 'segnalazione', 'modifica_manuale'));
