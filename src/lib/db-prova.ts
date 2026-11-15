// Solo per i test d'integrazione: un Postgres locale usa e getta (TEST_DATABASE_URL), uno schema per file di test,
// così i file possono girare in parallelo senza pestarsi i piedi. Rifiuta qualsiasi indirizzo di Render.

import type { Pool } from "pg";
import { creaPool } from "./db";
import { applicaMigrazioni } from "./migrazioni";

export async function databaseDiProva(url: string, schema: string): Promise<Pool> {
  if (/render\.com|onrender/.test(url)) throw new Error("TEST_DATABASE_URL punta a Render: mai");
  if (!/^[a-z_]+$/.test(schema)) throw new Error("schema non valido");
  const amministra = creaPool(url);
  try {
    await amministra.query(`drop schema if exists ${schema} cascade; create schema ${schema};`);
  } finally {
    await amministra.end();
  }
  const conSchema = new URL(url);
  conSchema.searchParams.set("options", `-c search_path=${schema}`);
  const db = creaPool(conSchema.toString());
  const c = await db.connect();
  try {
    await applicaMigrazioni(c);
  } finally {
    c.release();
  }
  return db;
}
