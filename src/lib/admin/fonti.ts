// Redazione: le fonti sorvegliate dal controllo notturno, le notti passate e le voci in coda che le riguardano.

import type { Pool } from "pg";
import type { Esito } from "./scritture";

export interface FonteRedazione {
  id: number;
  url: string;
  gara: string;
  raceId: string;
  formato: "pagina" | "pdf";
  esito: string | null;
  ultimoControllo: string | null;
  ultimaConferma: string | null;
  ultimoCambiamento: string | null;
  erroriConsecutivi: number;
  errore: string | null;
  /** Prezzi in corso con questa fonte, e quanti confermati in automatico. */
  prezzi: number;
  confermati: number;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function elencoFonti(db: Pool): Promise<FonteRedazione[]> {
  const { rows } = await db.query(`
    select s.id, s.url, r.nome as gara, s.race_id, s.formato, s.esito, s.ultimo_controllo, s.ultima_conferma,
           s.ultimo_cambiamento, s.errori_consecutivi, s.errore,
           count(p.id)::int as prezzi, count(p.confermato_il)::int as confermati
    from sources s
    join races r on r.id = s.race_id
    left join distances d on d.race_id = s.race_id
    left join prices p on p.distance_id = d.id and p.fonte_url = s.url
      and p.edizione = (select max(edizione) from prices q where q.distance_id = p.distance_id)
    group by s.id, r.nome
    order by (s.esito in ('errore', 'cambiata', 'non_controllabile', 'vietata_da_robots')) desc nulls last, r.nome, s.url`);
  return rows.map((r) => ({
    id: Number(r.id),
    url: r.url,
    gara: r.gara,
    raceId: r.race_id,
    formato: r.formato,
    esito: r.esito,
    ultimoControllo: iso(r.ultimo_controllo),
    ultimaConferma: iso(r.ultima_conferma),
    ultimoCambiamento: iso(r.ultimo_cambiamento),
    erroriConsecutivi: r.errori_consecutivi,
    errore: r.errore,
    prezzi: r.prezzi,
    confermati: r.confermati,
  }));
}

export interface Notte {
  id: number;
  iniziatoIl: string;
  finitoIl: string | null;
  prova: boolean;
  fonti: number | null;
  conteggi: Record<string, number>;
}

export async function ultimeNotti(db: Pool, quante = 14): Promise<Notte[]> {
  const { rows } = await db.query(
    `select id, iniziato_il, finito_il, prova, riepilogo from controlli_notturni order by id desc limit $1`,
    [quante],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    iniziatoIl: r.iniziato_il.toISOString(),
    finitoIl: iso(r.finito_il),
    prova: r.prova,
    fonti: r.riepilogo?.fonti ?? null,
    conteggi: r.riepilogo?.conteggi ?? {},
  }));
}

/** Annulla le conferme automatiche di una fonte (resta la data di chi ha verificato) e lo registra nello storico. */
export async function annullaConferme(db: Pool, sourceId: number, email: string): Promise<Esito> {
  const client = await db.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(`select race_id, url from sources where id = $1 for update`, [sourceId]);
    if (!rows[0]) {
      await client.query("rollback");
      return { ok: false, errori: ["Fonte non trovata."] };
    }
    const { race_id: raceId, url } = rows[0];
    const { rowCount } = await client.query(
      `update prices set confermato_il = null
       where fonte_url = $2 and confermato_il is not null
         and distance_id in (select id from distances where race_id = $1)`,
      [raceId, url],
    );
    await client.query(`update sources set ultima_conferma = null where id = $1`, [sourceId]);
    if (rowCount) {
      await client.query(
        `insert into review_queue (origine, race_id, source_id, diff_testo, proposta, stato, chiuso_il, chiuso_da)
         values ('modifica_manuale', $1, $2, $3, $4, 'approvata', now(), $5)`,
        [raceId, sourceId, `Conferme automatiche annullate (${rowCount} prezzi) per ${url}`, { chiave: null, url }, email],
      );
    }
    await client.query("commit");
    return { ok: true };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export type ChiusuraFonte = "riverificata" | "fatta" | "ignorata";

/**
 * Chiude una voce "cambio_fonte" o "link_rotto".
 * - riverificata: la redazione ha guardato la fonte e i dati sono giusti → data di verifica di oggi sui prezzi in corso
 *   con quella fonte (è una verifica di una persona) e voce approvata;
 * - fatta: i dati sono già stati corretti dalla scheda della distanza → voce approvata;
 * - ignorata: niente da fare → voce scartata.
 */
export async function chiudiVoceFonte(
  db: Pool,
  id: number,
  come: ChiusuraFonte,
  email: string,
  oggi: string,
): Promise<Esito> {
  const client = await db.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `select q.source_id, s.race_id, s.url from review_queue q left join sources s on s.id = q.source_id
       where q.id = $1 and q.stato = 'aperta' and q.origine in ('cambio_fonte', 'link_rotto') for update of q`,
      [id],
    );
    const voce = rows[0];
    if (!voce) {
      await client.query("rollback");
      return { ok: false, errori: ["Voce non trovata o già chiusa."] };
    }
    if (come === "riverificata" && voce.url) {
      await client.query(
        `update prices set data_rilevazione = $3
         where fonte_url = $2
           and distance_id in (select id from distances where race_id = $1)
           and edizione = (select max(edizione) from prices q where q.distance_id = prices.distance_id)`,
        [voce.race_id, voce.url, oggi],
      );
    }
    await client.query(
      `update review_queue set stato = $2, chiuso_il = now(), chiuso_da = $3,
         diff_testo = coalesce(diff_testo, '') || $4
       where id = $1`,
      [id, come === "ignorata" ? "scartata" : "approvata", email,
        come === "riverificata" ? "\n\n→ Dati invariati, riverificati sulla fonte." : come === "fatta" ? "\n\n→ Dati corretti dalla redazione." : ""],
    );
    await client.query("commit");
    return { ok: true };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export interface VoceFonte {
  id: number;
  origine: "cambio_fonte" | "link_rotto";
  stato: string;
  testo: string | null;
  url: string | null;
  gara: string | null;
  distanze: string[];
  creatoIl: string;
  chiusoIl: string | null;
  chiusoDa: string | null;
}

export async function leggiVoceFonte(db: Pool, id: number): Promise<VoceFonte | null> {
  const { rows } = await db.query(
    `select q.id, q.origine, q.stato, q.diff_testo, q.proposta, q.creato_il, q.chiuso_il, q.chiuso_da, s.url, r.nome as gara
     from review_queue q left join sources s on s.id = q.source_id left join races r on r.id = q.race_id
     where q.id = $1 and q.origine in ('cambio_fonte', 'link_rotto')`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    origine: r.origine,
    stato: r.stato,
    testo: r.diff_testo,
    url: r.url ?? r.proposta?.url ?? null,
    gara: r.gara,
    distanze: r.proposta?.distanze ?? [],
    creatoIl: r.creato_il.toISOString(),
    chiusoIl: iso(r.chiuso_il),
    chiusoDa: r.chiuso_da,
  };
}
