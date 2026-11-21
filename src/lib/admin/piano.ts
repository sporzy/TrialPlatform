// Un "piano" della redazione applicato in blocco: voci della coda nuova_gara da approvare, scartare o lasciare in
// bozza, e siti ufficiali da aggiungere alle gare. Usa le stesse funzioni dei pulsanti della redazione
// (approvaNuovaGara, scarta, salvaBozza), quindi le stesse regole: ciò che non le rispetta resta in bozza.
// Prima si prova (nessuna scrittura, solo il resoconto), poi si applica. Lo lancia scripts/applica-piano.ts.

import type { Pool } from "pg";
import { erroriPubblicazione, normalizzaRiga } from "./proposte";
import { approvaNuovaGara, salvaBozza, scarta } from "./scritture";
import { idDaRiga } from "../importa-csv";
import { sitoSicuro } from "../elenco";

export interface VocePiano {
  /** Paese, evento e distanza della proposta com'era quando è entrata in coda: ne danno la chiave (proposta.chiave). */
  originale: { paese: string; evento: string; distanza: string };
  azione: "approva" | "scarta" | "bozza";
  /** Riga completa da salvare (approva, bozza). */
  riga?: Record<string, string>;
  /** Perché si scarta o si lascia in coda: si aggiunge al motivo della voce. */
  motivo?: string;
}

export interface SitoPiano {
  paese: string;
  evento: string;
  sito: string;
}

export interface Piano {
  /** Chi risulta aver chiuso le voci nello storico. */
  chiusoDa: string;
  /** Data della verifica (AAAA-MM-GG). */
  oggi: string;
  voci: VocePiano[];
  siti: SitoPiano[];
}

interface VoceTrovata {
  id: number;
  stato: string;
}

async function trovaVoce(db: Pool, chiave: string): Promise<VoceTrovata | null> {
  const { rows } = await db.query(
    `select id, stato from review_queue where origine = 'nuova_gara' and proposta ->> 'chiave' = $1
     order by (stato = 'aperta') desc, id desc limit 1`,
    [chiave],
  );
  return rows[0] ? { id: Number(rows[0].id), stato: rows[0].stato } : null;
}

async function aggiungiMotivo(db: Pool, id: number, motivo: string, oggi: string): Promise<void> {
  await db.query(
    // Rilanciare il piano non ripete il motivo.
    `update review_queue set diff_testo = concat_ws(E'\\n', diff_testo, $2::text)
     where id = $1 and stato = 'aperta' and position($2::text in coalesce(diff_testo, '')) = 0`,
    [id, `Verifica del ${oggi}: ${motivo}`],
  );
}

/** Applica il piano (o lo prova, se `prova`): restituisce il resoconto riga per riga. */
export async function applicaPiano(db: Pool, piano: Piano, prova: boolean): Promise<string[]> {
  const out: string[] = [];
  const conteggio = { approvate: 0, scartate: 0, bozze: 0, saltate: 0, errori: 0, siti: 0 };
  const chiavi = new Set<string>();

  for (const v of piano.voci) {
    const chiave = idDaRiga(v.originale).distanceId;
    if (chiavi.has(chiave)) throw new Error(`Chiave ripetuta nel piano: ${chiave}`);
    chiavi.add(chiave);
    const voce = await trovaVoce(db, chiave);
    if (!voce || voce.stato !== "aperta") {
      out.push(`SALTATA  ${chiave}: ${voce ? `voce #${voce.id} già ${voce.stato}` : "nessuna voce in coda"}`);
      conteggio.saltate++;
      continue;
    }
    const etichetta = `#${voce.id} ${chiave}`;

    if (v.azione === "scarta") {
      if (!prova) {
        if (v.motivo) await aggiungiMotivo(db, voce.id, v.motivo, piano.oggi);
        const esito = await scarta(db, voce.id, piano.chiusoDa);
        if (!esito.ok) {
          out.push(`ERRORE   ${etichetta}: ${esito.errori.join(" ")}`);
          conteggio.errori++;
          continue;
        }
      }
      out.push(`SCARTA   ${etichetta}${v.motivo ? `: ${v.motivo}` : ""}`);
      conteggio.scartate++;
      continue;
    }

    if (!v.riga) throw new Error(`${etichetta}: manca la riga`);
    const riga = normalizzaRiga(v.riga);
    if (v.azione === "bozza") {
      if (!prova) {
        await salvaBozza(db, voce.id, riga);
        if (v.motivo) await aggiungiMotivo(db, voce.id, v.motivo, piano.oggi);
      }
      out.push(`BOZZA    ${etichetta}${v.motivo ? `: ${v.motivo}` : ""}`);
      conteggio.bozze++;
      continue;
    }

    const { raceId } = idDaRiga(riga);
    const esistente = await db.query(`select id from races where paese = $1 and nome = $2`, [riga.paese, riga.evento]);
    const dove = esistente.rows[0] ? `si aggancia alla gara esistente ${esistente.rows[0].id}` : `gara nuova ${raceId}`;
    if (prova) {
      const errori = erroriPubblicazione(riga, piano.oggi);
      if (errori.length) {
        out.push(`ERRORE   ${etichetta}: ${errori.join(" ")}`);
        conteggio.errori++;
      } else {
        out.push(`APPROVA  ${etichetta} → ${riga.evento} · ${riga.distanza} (${dove})`);
        conteggio.approvate++;
      }
      continue;
    }
    const esito = await approvaNuovaGara(db, voce.id, riga, piano.chiusoDa, piano.oggi);
    if (esito.ok) {
      out.push(`APPROVA  ${etichetta} → ${riga.evento} · ${riga.distanza} (${dove})`);
      conteggio.approvate++;
    } else {
      out.push(`ERRORE   ${etichetta}: resta in bozza. ${esito.errori.join(" ")}`);
      conteggio.errori++;
    }
  }

  for (const s of piano.siti) {
    const sito = sitoSicuro(s.sito);
    if (!sito) {
      out.push(`ERRORE   sito di ${s.paese} ${s.evento}: "${s.sito}" non è un indirizzo https`);
      conteggio.errori++;
      continue;
    }
    const { rows } = await db.query(
      `select r.id, r.sito, (select min(d.id) from distances d where d.race_id = r.id) as distanza
       from races r where r.paese = $1 and r.nome = $2`,
      [s.paese, s.evento],
    );
    const gara = rows[0];
    // In prova le gare che il piano approverebbe non esistono ancora: il loro sito arriva con la proposta.
    if (!gara) {
      out.push(`${prova ? "NUOVA?  " : "ERRORE  "} sito di ${s.paese} ${s.evento}: gara non trovata`);
      if (!prova) conteggio.errori++;
      continue;
    }
    if (gara.sito === sito) continue;
    if (gara.sito) {
      out.push(`SALTATO  sito di ${gara.id}: ha già ${gara.sito} (non lo cambio, proposto ${sito})`);
      conteggio.saltate++;
      continue;
    }
    if (!prova) {
      const client = await db.connect();
      try {
        await client.query("begin");
        await client.query(`update races set sito = $2 where id = $1 and sito is null`, [gara.id, sito]);
        await client.query(
          `insert into review_queue (origine, race_id, diff_testo, proposta, stato, chiuso_il, chiuso_da)
           values ('modifica_manuale', $1, $2, $3, 'approvata', now(), $4)`,
          [gara.id, `gara.sito: — → ${sito}`, { chiave: gara.distanza, dopo: { gara: { nome: s.evento } } }, piano.chiusoDa],
        );
        await client.query("commit");
      } catch (errore) {
        await client.query("rollback");
        throw errore;
      } finally {
        client.release();
      }
    }
    out.push(`SITO     ${gara.id} → ${sito}`);
    conteggio.siti++;
  }

  out.push(
    `${prova ? "PROVA (nessuna scrittura)" : "APPLICATO"}: ${conteggio.approvate} approvate, ${conteggio.scartate} scartate, ` +
      `${conteggio.bozze} bozze, ${conteggio.siti} siti, ${conteggio.saltate} saltate, ${conteggio.errori} errori.`,
  );
  return out;
}
