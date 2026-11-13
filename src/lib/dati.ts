// Unico punto da cui l'app legge i dati delle gare.
// La fonte è Postgres (DATABASE_URL, su Render e in .env.local). Senza database, solo in sviluppo e nei test,
// si leggono i dati d'esempio fermi di test/gare-esempio.csv (vedi test/LEGGIMI.md): non sono la fonte.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { leggiDaPostgres } from "./dati-postgres";
import { pool } from "./db";
import { importaGare, type DatiGare } from "./importa-csv";

export const PERCORSO_ESEMPIO = join("test", "gare-esempio.csv");

export async function caricaDati(): Promise<DatiGare> {
  if (process.env.DATABASE_URL) return leggiDaPostgres(pool());
  // In produzione dati vecchi mostrati come attuali sarebbero peggio di un errore.
  if (process.env.NODE_ENV === "production" && process.env.FAIRKM_DATI_ESEMPIO !== "1") {
    throw new Error("DATABASE_URL non impostata: in produzione i dati vengono solo da Postgres");
  }
  return caricaEsempio();
}

export async function caricaEsempio(): Promise<DatiGare> {
  return importaGare(await readFile(join(process.cwd(), PERCORSO_ESEMPIO), "utf8"));
}
