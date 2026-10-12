// Unico punto da cui l'app legge i dati.
// Con DATABASE_URL (es. in .env.local o su Render) legge Postgres; senza, legge data/gare.csv,
// così sviluppo e test funzionano anche senza database.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { leggiDaPostgres } from "./dati-postgres";
import { pool } from "./db";
import { importaGare, type DatiGare } from "./importa-csv";

export async function caricaDati(): Promise<DatiGare> {
  if (process.env.DATABASE_URL) return leggiDaPostgres(pool());
  return caricaDaCsv();
}

export async function caricaDaCsv(): Promise<DatiGare> {
  return importaGare(await readFile(join(process.cwd(), "data", "gare.csv"), "utf8"));
}
