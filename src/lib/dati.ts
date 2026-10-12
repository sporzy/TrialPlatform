// Unico punto da cui l'app legge i dati. Per ora data/gare.csv; al passo 7 Postgres su Render.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { importaGare, type DatiGare } from "./importa-csv";

export async function caricaDati(): Promise<DatiGare> {
  return importaGare(await readFile(join(process.cwd(), "data", "gare.csv"), "utf8"));
}
