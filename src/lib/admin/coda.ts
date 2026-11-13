// Letture e scritture della coda di revisione (review_queue). Niente va online senza approvazione.

import type { Pool } from "pg";
import type { OrigineRevisione, StatoRevisione } from "../tipi";

export interface VoceCoda {
  id: number;
  origine: OrigineRevisione;
  /** Breve descrizione leggibile della voce (gara · distanza, o la chiave). */
  titolo: string;
  /** Per le modifiche a mano: la distanza modificata. */
  distanceId: string | null;
  motivo: string | null;
  /** Timestamp ISO. */
  creatoIl: string;
}

interface RigaCoda {
  id: string | number;
  origine: OrigineRevisione;
  diff_testo: string | null;
  proposta: {
    chiave?: string;
    riga?: Record<string, string>;
    dopo?: { gara?: { nome?: string }; distanza?: { nome?: string } };
  } | null;
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
  const dopo = r.proposta?.dopo;
  const titolo = riga?.evento
    ? [riga.evento, riga.distanza].filter(Boolean).join(" · ")
    : dopo?.gara?.nome
      ? [dopo.gara.nome, dopo.distanza?.nome].filter(Boolean).join(" · ")
      : (r.proposta?.chiave ?? `#${r.id}`);
  return {
    id: Number(r.id),
    origine: r.origine,
    titolo,
    distanceId: r.origine === "modifica_manuale" ? (r.proposta?.chiave ?? null) : null,
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

export interface VoceChiusa extends VoceCoda {
  stato: StatoRevisione;
  chiusoIl: string;
  chiusoDa: string | null;
}

/** Ultime voci chiuse (approvate, scartate, modifiche a mano), le più recenti prima. */
export async function leggiUltimeChiuse(db: Pool, quante = 20): Promise<VoceChiusa[]> {
  const { rows } = await db.query<RigaCoda & { stato: StatoRevisione; chiuso_il: Date; chiuso_da: string | null }>(
    `select id, origine, diff_testo, proposta, creato_il, stato, chiuso_il, chiuso_da
     from review_queue where stato <> 'aperta' order by chiuso_il desc, id desc limit $1`,
    [quante],
  );
  return rows.map((r) => ({
    ...voceDaRiga(r),
    stato: r.stato,
    chiusoIl: r.chiuso_il.toISOString(),
    chiusoDa: r.chiuso_da,
  }));
}
