// Letture e scritture della coda di revisione (review_queue). Niente va online senza approvazione.

import type { Pool } from "pg";
import type { OrigineRevisione } from "../tipi";

export interface VoceCoda {
  id: number;
  origine: OrigineRevisione;
  /** Breve descrizione leggibile della voce (gara · distanza, o la chiave). */
  titolo: string;
  motivo: string | null;
  /** Timestamp ISO. */
  creatoIl: string;
}

interface RigaCoda {
  id: string | number;
  origine: OrigineRevisione;
  diff_testo: string | null;
  proposta: { chiave?: string; riga?: Record<string, string> } | null;
  creato_il: Date;
}

export async function leggiCodaAperta(db: Pool): Promise<VoceCoda[]> {
  const { rows } = await db.query<RigaCoda>(
    `select id, origine, diff_testo, proposta, creato_il from review_queue where stato = 'aperta' order by creato_il, id`,
  );
  return rows.map(voceDaRiga);
}

/** Da una riga di review_queue alla voce da mostrare (pura, testata). */
export function voceDaRiga(r: RigaCoda): VoceCoda {
  const riga = r.proposta?.riga;
  const titolo = riga?.evento ? [riga.evento, riga.distanza].filter(Boolean).join(" · ") : (r.proposta?.chiave ?? `#${r.id}`);
  return {
    id: Number(r.id),
    origine: r.origine,
    titolo,
    motivo: r.diff_testo,
    creatoIl: r.creato_il.toISOString(),
  };
}

export async function contaDati(db: Pool): Promise<{ gare: number; distanze: number; prezzi: number }> {
  const { rows } = await db.query<{ gare: number; distanze: number; prezzi: number }>(
    `select (select count(*)::int from races) as gare, (select count(*)::int from distances) as distanze,
            (select count(*)::int from prices) as prezzi`,
  );
  return rows[0];
}
