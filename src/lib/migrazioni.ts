// Applica in ordine le migrazioni di db/migrations/ non ancora applicate. La usa `npm run db:migra`
// (prima di ogni deploy su Render) e i test d'integrazione su un Postgres locale.
// Ogni file gira in una transazione ed è registrato in schema_migrations: rilanciare non rifà nulla.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PoolClient } from "pg";

const CARTELLA = join(process.cwd(), "db", "migrations");
// Numero arbitrario ma fisso: due migrazioni lanciate insieme si mettono in fila.
const LOCK = 7_402_015;

export async function applicaMigrazioni(client: PoolClient, log: (riga: string) => void = () => {}): Promise<void> {
  await client.query("select pg_advisory_lock($1)", [LOCK]);
  try {
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
        log(`  già applicata: ${nome}`);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(readFileSync(join(CARTELLA, nome), "utf8"));
        await client.query("insert into schema_migrations (nome) values ($1)", [nome]);
        await client.query("commit");
        log(`  applicata:     ${nome}`);
      } catch (errore) {
        await client.query("rollback");
        throw new Error(`Migrazione ${nome} fallita, nessuna modifica salvata: ${(errore as Error).message}`);
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => {});
  }
}
