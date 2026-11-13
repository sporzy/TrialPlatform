// Applica in ordine le migrazioni di db/migrations/ non ancora applicate (src/lib/migrazioni.ts).
// Uso: npm run db:migra. Su Render gira da sola prima di ogni deploy (preDeployCommand in render.yaml).

import "./env";
import { creaPool } from "../src/lib/db";
import { applicaMigrazioni } from "../src/lib/migrazioni";

async function main() {
  const db = creaPool();
  const client = await db.connect();
  try {
    await applicaMigrazioni(client, console.log);
  } finally {
    client.release();
    await db.end();
  }
}

main().catch((errore) => {
  console.error((errore as Error).message);
  process.exit(1);
});
