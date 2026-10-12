import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mappaRighe } from "./dati-postgres";
import { importaGare } from "./importa-csv";

const dati = importaGare(readFileSync(join(process.cwd(), "data/gare.csv"), "utf8"));

// Le righe come le restituisce Postgres (snake_case; colonne in più come id e created_at).
const righeDb = {
  races: dati.races.map((r) => ({
    id: r.id, nome: r.nome, paese: r.paese, regione: r.regione, organizzatore: r.organizzatore, sito: r.sito,
    categoria: r.categoria, qualifica_utmb: r.qualificaUtmb, itra: r.itra, created_at: new Date(),
  })),
  distances: dati.distances.map((d) => ({
    id: d.id, race_id: d.raceId, nome: d.nome, km: d.km, dplus: d.dplus, cancelli: d.cancelli,
    materiale_obbligatorio: d.materialeObbligatorio, gpx_url: d.gpxUrl, riferimento_nazionale: d.riferimentoNazionale,
    note: d.note, created_at: new Date(),
  })),
  prices: dati.prices.map((p, i) => ({
    id: String(i + 1), distance_id: p.distanceId, edizione: p.edizione, prezzo: p.prezzo, valuta: p.valuta,
    scaglione: p.scaglione, include_iva: p.includeIva, include_commissioni: p.includeCommissioni,
    fonte_url: p.fonteUrl, data_rilevazione: p.dataRilevazione, valido_dal: p.validoDal, valido_fino: p.validoFino,
    fino_a_iscritti: p.finoAIscritti, ordine: p.ordine, created_at: new Date(),
  })),
};

describe("mappaRighe", () => {
  it("dalle righe di Postgres si torna esattamente al modello importato dal CSV", () => {
    expect(mappaRighe(righeDb)).toEqual(dati);
  });

  it("converte in numero i valori numeric arrivati come stringa", () => {
    const [d] = mappaRighe({ ...righeDb, distances: [{ ...righeDb.distances[0], km: "14.45" }] }).distances;
    expect(d.km).toBe(14.45);
  });
});
