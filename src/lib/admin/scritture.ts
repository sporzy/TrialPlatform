// Scritture della redazione nel database. Ogni scrittura è una transazione: o va tutto, o niente.
// Chi chiude una voce della coda resta registrato (chiuso_da, email di Cloudflare Access).

import type { Pool, PoolClient } from "pg";
import { idDaRiga, slug, type DatiRiga, type RigaGare } from "../importa-csv";
import type { OrigineRevisione, StatoRevisione } from "../tipi";
import { datiDaPubblicare, normalizzaRiga } from "./proposte";

export interface VoceDettaglio {
  id: number;
  origine: OrigineRevisione;
  stato: StatoRevisione;
  motivo: string | null;
  chiave: string | null;
  riga: RigaGare;
  creatoIl: string;
  chiusoIl: string | null;
  chiusoDa: string | null;
}

export type Esito = { ok: true } | { ok: false; errori: string[] };

async function inTransazione<T>(db: Pool, lavoro: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("begin");
    const risultato = await lavoro(client);
    await client.query("commit");
    return risultato;
  } catch (errore) {
    await client.query("rollback");
    throw errore;
  } finally {
    client.release();
  }
}

export async function leggiVoce(db: Pool | PoolClient, id: number): Promise<VoceDettaglio | null> {
  const { rows } = await db.query(
    `select id, origine, stato, diff_testo, proposta, creato_il, chiuso_il, chiuso_da from review_queue where id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    origine: r.origine,
    stato: r.stato,
    motivo: r.diff_testo,
    chiave: r.proposta?.chiave ?? null,
    riga: normalizzaRiga(r.proposta?.riga),
    creatoIl: (r.creato_il as Date).toISOString(),
    chiusoIl: r.chiuso_il ? (r.chiuso_il as Date).toISOString() : null,
    chiusoDa: r.chiuso_da,
  };
}

/**
 * Nuova proposta "nuova_gara" dal modulo della redazione: entra in coda aperta, si approva dalla sua scheda.
 * Se per la stessa distanza c'è già una proposta aperta, restituisce quella (niente doppioni).
 */
export async function creaProposta(db: Pool, dati: Record<string, unknown>, motivo: string): Promise<{ id: number; nuova: boolean }> {
  const riga = normalizzaRiga(dati);
  const chiave = idDaRiga(riga).distanceId;
  const { rows } = await db.query(
    `insert into review_queue (origine, diff_testo, proposta) values ('nuova_gara', $1, $2)
     on conflict ((proposta ->> 'chiave')) where origine = 'nuova_gara' and stato = 'aperta' do nothing
     returning id`,
    [motivo, { chiave, riga }],
  );
  if (rows[0]) return { id: Number(rows[0].id), nuova: true };
  const esistente = await db.query(
    `select id from review_queue where origine = 'nuova_gara' and stato = 'aperta' and proposta ->> 'chiave' = $1`,
    [chiave],
  );
  return { id: Number(esistente.rows[0].id), nuova: false };
}

/** Salva la riga di una proposta ancora aperta, senza pubblicarla. */
export async function salvaBozza(db: Pool, id: number, dati: Record<string, unknown>): Promise<Esito> {
  const riga = normalizzaRiga(dati);
  const { rowCount } = await db.query(
    `update review_queue set proposta = jsonb_set(coalesce(proposta, '{}'::jsonb), '{riga}', $2::jsonb)
     where id = $1 and stato = 'aperta' and origine = 'nuova_gara'`,
    [id, JSON.stringify(riga)],
  );
  return rowCount ? { ok: true } : { ok: false, errori: ["Voce non trovata o già chiusa."] };
}

/** Chiude una voce aperta senza pubblicare nulla. */
export async function scarta(db: Pool, id: number, email: string): Promise<Esito> {
  const { rowCount } = await db.query(
    `update review_queue set stato = 'scartata', chiuso_il = now(), chiuso_da = $2 where id = $1 and stato = 'aperta'`,
    [id, email],
  );
  return rowCount ? { ok: true } : { ok: false, errori: ["Voce non trovata o già chiusa."] };
}

/**
 * Approva una proposta "nuova_gara": salva la riga così com'è, la controlla con le regole di pubblicazione e,
 * se va bene, inserisce gara (se non esiste già: i suoi dati non vengono toccati), distanza e prezzi, e chiude la voce.
 * Se qualcosa non va non pubblica nulla, ma la riga resta salvata come bozza.
 */
export async function approvaNuovaGara(
  db: Pool,
  id: number,
  dati: Record<string, unknown>,
  email: string,
  oggi: string,
): Promise<Esito> {
  const bozza = await salvaBozza(db, id, dati);
  if (!bozza.ok) return bozza;
  const riga = normalizzaRiga(dati);
  const { dati: daPubblicare, errori } = datiDaPubblicare(riga, oggi);
  if (!daPubblicare) return { ok: false, errori };

  return inTransazione(db, async (client) => {
    // Blocca la voce: due approvazioni insieme non pubblicano due volte.
    const { rows } = await client.query(
      `select stato, origine from review_queue where id = $1 for update`,
      [id],
    );
    if (rows[0]?.stato !== "aperta" || rows[0]?.origine !== "nuova_gara") {
      return { ok: false, errori: ["Voce non trovata o già chiusa."] } as Esito;
    }
    // Finora solo letture: tornare indietro qui non lascia nulla di scritto.
    const dati = await allineaAllaGaraEsistente(client, daPubblicare);
    const conflitti = await conflittiPubblicazione(client, dati);
    if (conflitti.length) return { ok: false, errori: conflitti } as Esito;
    await inserisciDati(client, dati);
    await client.query(
      `update review_queue set stato = 'approvata', chiuso_il = now(), chiuso_da = $2 where id = $1`,
      [id, email],
    );
    return { ok: true } as Esito;
  });
}

/**
 * Una gara già pubblicata con lo stesso paese e nome tiene il suo id, anche se il nome è stato corretto dopo
 * (l'id nasce dal nome originale): la distanza nuova si attacca a quella gara invece di crearne un doppione.
 */
async function allineaAllaGaraEsistente(client: PoolClient, dati: DatiRiga): Promise<DatiRiga> {
  const { rows } = await client.query(`select id from races where paese = $1 and nome = $2`, [dati.race.paese, dati.race.nome]);
  const raceId: string | undefined = rows[0]?.id;
  if (!raceId || raceId === dati.race.id) return dati;
  const distanceId = `${raceId}--${slug(dati.distance.nome)}`;
  return {
    race: { ...dati.race, id: raceId },
    distance: { ...dati.distance, id: distanceId, raceId },
    prices: dati.prices.map((p) => ({ ...p, distanceId })),
  };
}

/** Cosa impedisce di inserire questi dati accanto a quelli già pubblicati. */
async function conflittiPubblicazione(client: PoolClient, { race, distance }: DatiRiga): Promise<string[]> {
  const errori: string[] = [];
  const gara = await client.query(`select id, nome, categoria from races where id = $1 or (paese = $2 and nome = $3)`, [
    race.id, race.paese, race.nome,
  ]);
  for (const g of gara.rows) {
    if (g.id !== race.id) errori.push(`Esiste già una gara "${g.nome}" con un altro id (${g.id}).`);
    else if (g.categoria !== race.categoria) {
      errori.push(`La gara esiste già con categoria "${g.categoria}": la nuova distanza deve avere la stessa.`);
    }
  }
  const dist = await client.query(`select 1 from distances where id = $1 or (race_id = $2 and nome = $3)`, [
    distance.id, distance.raceId, distance.nome,
  ]);
  if (dist.rowCount) errori.push(`La distanza "${distance.nome}" esiste già: per cambiarla si modifica, non si aggiunge.`);
  return errori;
}

/** Inserisce gara (se manca), distanza e prezzi. Una gara già presente non viene modificata. */
export async function inserisciDati(client: PoolClient, { race, distance, prices }: DatiRiga): Promise<void> {
  await client.query(
    `insert into races (id, nome, paese, regione, organizzatore, sito, categoria, qualifica_utmb, itra, fonte_storico_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (id) do nothing`,
    [race.id, race.nome, race.paese, race.regione, race.organizzatore, race.sito, race.categoria, race.qualificaUtmb,
      race.itra, race.fonteStoricoUrl],
  );
  await client.query(
    `insert into distances (id, race_id, nome, km, dplus, cancelli, materiale_obbligatorio, gpx_url,
       riferimento_nazionale, note, altre_fonti_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [distance.id, distance.raceId, distance.nome, distance.km, distance.dplus, distance.cancelli,
      distance.materialeObbligatorio, distance.gpxUrl, distance.riferimentoNazionale, distance.note, distance.altreFontiUrl],
  );
  for (const p of prices) {
    await client.query(
      `insert into prices (distance_id, edizione, prezzo, valuta, scaglione, include_iva, include_commissioni,
         fonte_url, fonte_tipo, data_rilevazione, valido_dal, valido_fino, fino_a_iscritti, ordine)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [p.distanceId, p.edizione, p.prezzo, p.valuta, p.scaglione, p.includeIva, p.includeCommissioni, p.fonteUrl,
        p.fonteTipo, p.dataRilevazione, p.validoDal, p.validoFino, p.finoAIscritti, p.ordine],
    );
  }
}
