// Connessione a Postgres (Render). L'URL arriva sempre da DATABASE_URL, mai scritto nel codice.

import { Pool, types } from "pg";

// Le colonne `date` restano stringhe ISO (AAAA-MM-GG): niente conversioni di fuso orario.
types.setTypeParser(types.builtins.DATE, (v) => v);
// numeric (prezzi, km) → number. I valori stanno ben dentro la precisione di un double.
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));

/**
 * Pool condiviso. L'URL esterno di Render (host *.render.com) richiede SSL;
 * quello interno, usato dai servizi Render nella stessa regione, no.
 */
export function creaPool(url: string | undefined = process.env.DATABASE_URL): Pool {
  if (!url) throw new Error("DATABASE_URL non impostata (vedi .env.local)");
  const host = new URL(url).hostname;
  return new Pool({
    connectionString: url,
    ssl: host.endsWith(".render.com") ? { rejectUnauthorized: true } : undefined,
    max: 5,
  });
}

// In sviluppo Next ricarica i moduli: il pool sta su globalThis per non aprire connessioni a ogni modifica.
const globale = globalThis as unknown as { poolFairKm?: Pool };

export function pool(): Pool {
  globale.poolFairKm ??= creaPool();
  return globale.poolFairKm;
}
