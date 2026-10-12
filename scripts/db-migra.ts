// Applica in ordine le migrazioni di db/migrations/ non ancora applicate.
// Uso: npm run db:migra
// Ogni file gira in una transazione ed è registrato in schema_migrations: rilanciare non rifà nulla.

import "./env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { creaPool } from "../src/lib/db";

const CARTELLA = join(process.cwd(), "db", "migrations");
// Numero arbitrario ma fisso: due migrazioni lanciate insieme si mettono in fila.
const LOCK = 7_402_015;

async function main() {
  const db = creaPool();
  const client = await db.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK]);
    await client.query(`
      create table if not exists schema_migrations (
        nome         text primary key,
        applicata_il timestamptz not null default now()
      )`);
    const applicate = new Set(
      (await client.query<{ nome: string }>("select nome from schema_migrations")).rows.map((r) => r.nome),
    );
    const file = readdirSync(CARTELLA).filter((f) => f.endsWith(".sql")).sort();

    for (const nome of file) {
      if (applicate.has(nome)) {
        console.log(`  già applicata: ${nome}`);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(readFileSync(join(CARTELLA, nome), "utf8"));
        await client.query("insert into schema_migrations (nome) values ($1)", [nome]);
        await client.query("commit");
        console.log(`  applicata:     ${nome}`);
      } catch (errore) {
        await client.query("rollback");
        throw new Error(`Migrazione ${nome} fallita, nessuna modifica salvata: ${(errore as Error).message}`);
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    client.release();
    await db.end();
  }
}

main().catch((errore) => {
  console.error((errore as Error).message);
  process.exit(1);
});
