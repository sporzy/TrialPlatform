// Carica data/gare.csv in Postgres: gare, distanze e prezzi.
// Uso:
//   npm run db:seed          inserisce o aggiorna (rilanciabile: niente doppioni)
//   npm run db:seed -- --conta      solo i conteggi
//   npm run db:verifica      confronta il contenuto del database con il CSV
// Non cancella mai: le righe presenti nel database ma non nel CSV vengono solo segnalate.

import "./env";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { caricaDaCsv } from "../src/lib/dati";
import { leggiDaPostgres } from "../src/lib/dati-postgres";
import { creaPool } from "../src/lib/db";
import type { DatiGare } from "../src/lib/importa-csv";

const args = new Set(process.argv.slice(2));

async function main() {
  const db = creaPool();
  try {
    if (args.has("--verifica")) {
      const [csv, pg] = await Promise.all([caricaDaCsv(), leggiDaPostgres(db)]);
      const differenze = confronta(csv, pg);
      if (differenze.length) {
        console.error(`Database diverso dal CSV:\n  ${differenze.join("\n  ")}`);
        process.exitCode = 1;
      } else {
        console.log("Database identico al CSV.");
      }
    } else if (!args.has("--conta")) {
      const dati = await caricaDaCsv();
      const client = await db.connect();
      try {
        await client.query("begin");
        await carica(client, dati);
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
      `Nel database: ${await conta("races")} gare, ${await conta("distances")} distanze, ${await conta("prices")} prezzi.`,
    );
  } finally {
    await db.end();
  }
}

async function carica(client: PoolClient, { races, distances, prices }: DatiGare) {
  for (const r of races) {
    await client.query(
      `insert into races (id, nome, paese, regione, organizzatore, sito, categoria, qualifica_utmb, itra)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set nome = excluded.nome, paese = excluded.paese, regione = excluded.regione,
         organizzatore = excluded.organizzatore, sito = excluded.sito, categoria = excluded.categoria,
         qualifica_utmb = excluded.qualifica_utmb, itra = excluded.itra`,
      [r.id, r.nome, r.paese, r.regione, r.organizzatore, r.sito, r.categoria, r.qualificaUtmb, r.itra],
    );
  }
  for (const d of distances) {
    await client.query(
      `insert into distances (id, race_id, nome, km, dplus, cancelli, materiale_obbligatorio, gpx_url,
         riferimento_nazionale, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set race_id = excluded.race_id, nome = excluded.nome, km = excluded.km,
         dplus = excluded.dplus, cancelli = excluded.cancelli, materiale_obbligatorio = excluded.materiale_obbligatorio,
         gpx_url = excluded.gpx_url, riferimento_nazionale = excluded.riferimento_nazionale, note = excluded.note`,
      [d.id, d.raceId, d.nome, d.km, d.dplus, d.cancelli, d.materialeObbligatorio, d.gpxUrl, d.riferimentoNazionale, d.note],
    );
  }
  for (const p of prices) {
    await client.query(
      `insert into prices (distance_id, edizione, prezzo, valuta, scaglione, include_iva, include_commissioni,
         fonte_url, data_rilevazione, valido_dal, valido_fino, fino_a_iscritti, ordine)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       on conflict (distance_id, edizione, scaglione, ordine) do update set prezzo = excluded.prezzo,
         valuta = excluded.valuta, include_iva = excluded.include_iva, include_commissioni = excluded.include_commissioni,
         fonte_url = excluded.fonte_url, data_rilevazione = excluded.data_rilevazione, valido_dal = excluded.valido_dal,
         valido_fino = excluded.valido_fino, fino_a_iscritti = excluded.fino_a_iscritti`,
      [p.distanceId, p.edizione, p.prezzo, p.valuta, p.scaglione, p.includeIva, p.includeCommissioni, p.fonteUrl,
        p.dataRilevazione, p.validoDal, p.validoFino, p.finoAIscritti, p.ordine],
    );
  }
  console.log(`Caricati dal CSV: ${races.length} gare, ${distances.length} distanze, ${prices.length} prezzi.`);
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
