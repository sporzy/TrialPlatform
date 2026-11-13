// Carica data/gare.csv in Postgres (gare, distanze e prezzi) e data/da-verificare.csv nella coda di revisione
// come proposte "nuova_gara". Serve al passaggio una tantum dai CSV al database (2026-11-13).
// Uso:
//   npm run db:seed          inserisce o aggiorna (rilanciabile: niente doppioni)
//   npm run db:seed -- --conta      solo i conteggi
//   npm run db:verifica      confronta il contenuto del database con i due CSV
// Non cancella mai: le righe presenti nel database ma non nel CSV vengono solo segnalate.

import "./env";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { caricaDaCsv } from "../src/lib/dati";
import { leggiDaPostgres } from "../src/lib/dati-postgres";
import { creaPool } from "../src/lib/db";
import { COLONNE_GARE, parseCsv, slug, type DatiGare } from "../src/lib/importa-csv";

const args = new Set(process.argv.slice(2));

async function main() {
  const db = creaPool();
  try {
    if (args.has("--verifica")) {
      const [csv, pg] = await Promise.all([caricaDaCsv(), leggiDaPostgres(db)]);
      const differenze = [...confronta(csv, pg), ...(await confrontaCoda(db, await leggiDaVerificare()))];
      if (differenze.length) {
        console.error(`Database diverso dai CSV:\n  ${differenze.join("\n  ")}`);
        process.exitCode = 1;
      } else {
        console.log("Database identico ai CSV (gare.csv e da-verificare.csv nella coda).");
      }
    } else if (!args.has("--conta")) {
      const dati = await caricaDaCsv();
      const client = await db.connect();
      try {
        await client.query("begin");
        await carica(client, dati);
        await caricaCoda(client, await leggiDaVerificare());
        await client.query("commit");
      } catch (errore) {
        await client.query("rollback");
        throw errore;
      } finally {
        client.release();
      }
      await segnalaExtra(db, dati);
    }
    const conta = async (t: string) => (await db.query(`select count(*)::int as n from ${t}`)).rows[0].n;
    console.log(
      `Nel database: ${await conta("races")} gare, ${await conta("distances")} distanze, ${await conta("prices")} prezzi, ` +
        `${await conta("review_queue where stato = 'aperta'")} voci aperte in coda.`,
    );
  } finally {
    await db.end();
  }
}

async function carica(client: PoolClient, { races, distances, prices }: DatiGare) {
  for (const r of races) {
    await client.query(
      `insert into races (id, nome, paese, regione, organizzatore, sito, categoria, qualifica_utmb, itra,
         fonte_storico_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set nome = excluded.nome, paese = excluded.paese, regione = excluded.regione,
         organizzatore = excluded.organizzatore, sito = excluded.sito, categoria = excluded.categoria,
         qualifica_utmb = excluded.qualifica_utmb, itra = excluded.itra, fonte_storico_url = excluded.fonte_storico_url`,
      [r.id, r.nome, r.paese, r.regione, r.organizzatore, r.sito, r.categoria, r.qualificaUtmb, r.itra,
        r.fonteStoricoUrl],
    );
  }
  for (const d of distances) {
    await client.query(
      `insert into distances (id, race_id, nome, km, dplus, cancelli, materiale_obbligatorio, gpx_url,
         riferimento_nazionale, note, altre_fonti_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update set race_id = excluded.race_id, nome = excluded.nome, km = excluded.km,
         dplus = excluded.dplus, cancelli = excluded.cancelli, materiale_obbligatorio = excluded.materiale_obbligatorio,
         gpx_url = excluded.gpx_url, riferimento_nazionale = excluded.riferimento_nazionale, note = excluded.note,
         altre_fonti_url = excluded.altre_fonti_url`,
      [d.id, d.raceId, d.nome, d.km, d.dplus, d.cancelli, d.materialeObbligatorio, d.gpxUrl, d.riferimentoNazionale, d.note,
        d.altreFontiUrl],
    );
  }
  for (const p of prices) {
    await client.query(
      `insert into prices (distance_id, edizione, prezzo, valuta, scaglione, include_iva, include_commissioni,
         fonte_url, data_rilevazione, valido_dal, valido_fino, fino_a_iscritti, ordine, fonte_tipo)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       on conflict (distance_id, edizione, scaglione, ordine) do update set prezzo = excluded.prezzo,
         valuta = excluded.valuta, include_iva = excluded.include_iva, include_commissioni = excluded.include_commissioni,
         fonte_url = excluded.fonte_url, data_rilevazione = excluded.data_rilevazione, valido_dal = excluded.valido_dal,
         valido_fino = excluded.valido_fino, fino_a_iscritti = excluded.fino_a_iscritti, fonte_tipo = excluded.fonte_tipo`,
      [p.distanceId, p.edizione, p.prezzo, p.valuta, p.scaglione, p.includeIva, p.includeCommissioni, p.fonteUrl,
        p.dataRilevazione, p.validoDal, p.validoFino, p.finoAIscritti, p.ordine, p.fonteTipo],
    );
  }
  console.log(`Caricati dal CSV: ${races.length} gare, ${distances.length} distanze, ${prices.length} prezzi.`);
}

// Righe di data/da-verificare.csv: stesse colonne di gare.csv più "motivo". Non sono dati pubblicabili
// (manca una fonte primaria o un prezzo 2026+): diventano proposte "nuova_gara" da completare e approvare.
interface Proposta {
  chiave: string;
  riga: Record<string, string>;
  motivo: string;
}

async function leggiDaVerificare(): Promise<Proposta[]> {
  const testo = await readFile(join(process.cwd(), "data", "da-verificare.csv"), "utf8");
  const [intestazione, ...righe] = parseCsv(testo);
  const attese = [...COLONNE_GARE, "motivo"];
  if (intestazione?.join(",") !== attese.join(",")) {
    throw new Error(`Intestazione di da-verificare.csv inattesa: ${intestazione?.join(",")}`);
  }
  const proposte = righe.map((valori, i) => {
    if (valori.length !== attese.length) throw new Error(`da-verificare.csv riga ${i + 2}: ${valori.length} campi`);
    const tutto = Object.fromEntries(attese.map((c, j) => [c, valori[j].trim()]));
    const { motivo, ...riga } = tutto;
    return { chiave: `${slug(`${riga.paese} ${riga.evento}`)}--${slug(riga.distanza)}`, riga, motivo };
  });
  const doppie = proposte.map((p) => p.chiave).filter((k, i, tutte) => tutte.indexOf(k) !== i);
  if (doppie.length) throw new Error(`da-verificare.csv: righe doppie ${doppie.join(", ")}`);
  return proposte;
}

async function caricaCoda(client: PoolClient, proposte: Proposta[]) {
  let nuove = 0;
  for (const p of proposte) {
    // L'indice review_queue_nuova_gara_aperta_idx (0003) tiene una sola proposta aperta per chiave.
    const { rowCount } = await client.query(
      `insert into review_queue (origine, diff_testo, proposta)
       values ('nuova_gara', $1, $2)
       on conflict ((proposta ->> 'chiave')) where origine = 'nuova_gara' and stato = 'aperta' do nothing`,
      [p.motivo, p],
    );
    nuove += rowCount ?? 0;
  }
  console.log(`Coda di revisione: ${nuove} proposte nuove su ${proposte.length} righe da verificare.`);
}

async function confrontaCoda(db: ReturnType<typeof creaPool>, proposte: Proposta[]): Promise<string[]> {
  const { rows } = await db.query<{ proposta: Proposta; diff_testo: string | null }>(
    `select proposta, diff_testo from review_queue where origine = 'nuova_gara'`,
  );
  const inCoda = new Map(rows.map((r) => [r.proposta.chiave, r]));
  return proposte.flatMap((p) => {
    const voce = inCoda.get(p.chiave);
    if (!voce) return [`proposta mancante nella coda: ${p.chiave}`];
    if (!isDeepStrictEqual(voce.proposta, p) || voce.diff_testo !== p.motivo) return [`proposta diversa: ${p.chiave}`];
    return [];
  });
}

async function segnalaExtra(db: ReturnType<typeof creaPool>, dati: DatiGare) {
  const nelDb = await leggiDaPostgres(db);
  const extra = [
    ...diff(nelDb.races.map((r) => r.id), dati.races.map((r) => r.id), "gara"),
    ...diff(nelDb.distances.map((d) => d.id), dati.distances.map((d) => d.id), "distanza"),
    ...diff(nelDb.prices.map(chiavePrezzo), dati.prices.map(chiavePrezzo), "prezzo"),
  ];
  if (extra.length) console.warn(`Nel database ma non nel CSV (non cancellati):\n  ${extra.join("\n  ")}`);
}

function confronta(csv: DatiGare, pg: DatiGare): string[] {
  const differenze: string[] = [];
  const perChiave = <T>(lista: T[], chiave: (x: T) => string) => new Map(lista.map((x) => [chiave(x), x]));
  const tabelle = [
    ["gara", perChiave(csv.races, (r) => r.id), perChiave(pg.races, (r) => r.id)],
    ["distanza", perChiave(csv.distances, (d) => d.id), perChiave(pg.distances, (d) => d.id)],
    ["prezzo", perChiave(csv.prices, chiavePrezzo), perChiave(pg.prices, chiavePrezzo)],
  ] as const;
  for (const [tipo, a, b] of tabelle) {
    for (const [k, v] of a as Map<string, unknown>) {
      if (!(b as Map<string, unknown>).has(k)) differenze.push(`${tipo} mancante nel database: ${k}`);
      else if (!isDeepStrictEqual(v, (b as Map<string, unknown>).get(k))) differenze.push(`${tipo} diversa: ${k}`);
    }
    for (const k of (b as Map<string, unknown>).keys()) {
      if (!(a as Map<string, unknown>).has(k)) differenze.push(`${tipo} in più nel database: ${k}`);
    }
  }
  return differenze;
}

function chiavePrezzo(p: { distanceId: string; edizione: number; scaglione: string; ordine: number }) {
  return `${p.distanceId} ${p.edizione} ${p.scaglione} ${p.ordine}`;
}

function diff(nelDb: string[], nelCsv: string[], tipo: string) {
  const csv = new Set(nelCsv);
  return nelDb.filter((k) => !csv.has(k)).map((k) => `${tipo}: ${k}`);
}

main().catch((errore) => {
  console.error((errore as Error).message);
  process.exit(1);
});
