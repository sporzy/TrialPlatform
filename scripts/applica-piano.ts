// Applica un piano della redazione (src/lib/admin/piano.ts) letto da un file JSON in db/piani/.
// Uso: npx tsx scripts/applica-piano.ts db/piani/<file>.json            → prova: nessuna scrittura, solo il resoconto
//      npx tsx scripts/applica-piano.ts db/piani/<file>.json --applica  → scrive
// Su Render: render jobs create <servizio> --start-command "npx tsx scripts/applica-piano.ts ... [--applica]".

import "./env";
import { readFileSync } from "node:fs";
import { applicaPiano, type Piano } from "../src/lib/admin/piano";
import { creaPool } from "../src/lib/db";

async function main() {
  const [file, opzione] = process.argv.slice(2);
  if (!file || (opzione && opzione !== "--applica")) {
    throw new Error("Uso: tsx scripts/applica-piano.ts <piano.json> [--applica]");
  }
  const piano = JSON.parse(readFileSync(file, "utf8")) as Piano;
  const db = creaPool();
  try {
    for (const riga of await applicaPiano(db, piano, opzione !== "--applica")) console.log(riga);
  } finally {
    await db.end();
  }
}

main().catch((errore) => {
  console.error((errore as Error).message);
  process.exit(1);
});
