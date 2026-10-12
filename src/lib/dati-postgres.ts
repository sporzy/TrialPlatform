// Lettura di gare, distanze e prezzi da Postgres nello stesso formato di importaGare().

import type { Pool } from "pg";
import type { DatiGare } from "./importa-csv";
import type { Categoria, Scaglione } from "./tipi";

export interface RigheDb {
  races: Record<string, unknown>[];
  distances: Record<string, unknown>[];
  prices: Record<string, unknown>[];
}

// Ordine stabile per id: l'elenco ordina comunque per costo, e il confronto con il CSV ordina entrambi.
export async function leggiDaPostgres(db: Pool): Promise<DatiGare> {
  const [races, distances, prices] = await Promise.all([
    db.query("select * from races order by id"),
    db.query("select * from distances order by id"),
    db.query("select * from prices order by distance_id, edizione desc, scaglione, ordine"),
  ]);
  return mappaRighe({ races: races.rows, distances: distances.rows, prices: prices.rows });
}

/** Da righe snake_case di Postgres ai tipi del modello (pura, testata). */
export function mappaRighe(righe: RigheDb): DatiGare {
  return {
    races: righe.races.map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      paese: r.paese as string,
      regione: (r.regione as string | null) ?? null,
      organizzatore: (r.organizzatore as string | null) ?? null,
      sito: (r.sito as string | null) ?? null,
      categoria: r.categoria as Categoria,
      qualificaUtmb: r.qualifica_utmb as boolean,
      itra: (r.itra as number | null) ?? null,
    })),
    distances: righe.distances.map((d) => ({
      id: d.id as string,
      raceId: d.race_id as string,
      nome: d.nome as string,
      km: Number(d.km),
      dplus: Number(d.dplus),
      cancelli: (d.cancelli as string | null) ?? null,
      materialeObbligatorio: (d.materiale_obbligatorio as string | null) ?? null,
      gpxUrl: (d.gpx_url as string | null) ?? null,
      riferimentoNazionale: d.riferimento_nazionale as boolean,
      note: (d.note as string | null) ?? null,
    })),
    prices: righe.prices.map((p) => ({
      distanceId: p.distance_id as string,
      edizione: Number(p.edizione),
      prezzo: Number(p.prezzo),
      valuta: p.valuta as string,
      scaglione: p.scaglione as Scaglione,
      includeIva: (p.include_iva as boolean | null) ?? null,
      includeCommissioni: (p.include_commissioni as boolean | null) ?? null,
      fonteUrl: (p.fonte_url as string | null) ?? null,
      dataRilevazione: (p.data_rilevazione as string | null) ?? null,
      validoDal: (p.valido_dal as string | null) ?? null,
      validoFino: (p.valido_fino as string | null) ?? null,
      finoAIscritti: (p.fino_a_iscritti as number | null) ?? null,
      ordine: Number(p.ordine),
    })),
  };
}
