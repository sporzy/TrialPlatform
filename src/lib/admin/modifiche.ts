// Correzioni a mano dei dati già pubblicati (una distanza alla volta: la sua gara, la distanza, i suoi prezzi).
// Ogni salvataggio è una transazione e lascia in coda una voce "modifica_manuale" già chiusa, con prima, dopo,
// chi e quando: niente cambia senza traccia.

import type { Pool, PoolClient } from "pg";
import { EDIZIONE_MINIMA, eFontePrimaria } from "../regole";
import { CATEGORIE, SCAGLIONI } from "../tipi";
import type { Esito } from "./scritture";

/** Valori come stanno nel modulo (testo); `id` null = prezzo nuovo. */
export interface PrezzoModulo {
  id: number | null;
  edizione: string;
  scaglione: string;
  ordine: string;
  prezzo: string;
  valuta: string;
  fonte_url: string;
  fonte_tipo: string;
  data_rilevazione: string;
  include_iva: string;
  include_commissioni: string;
  elimina: boolean;
}

export interface ModuloDistanza {
  gara: {
    nome: string;
    regione: string;
    categoria: string;
    organizzatore: string;
    sito: string;
    qualifica_utmb: string;
    fonte_storico_url: string;
  };
  distanza: {
    nome: string;
    km: string;
    dplus: string;
    riferimento_nazionale: string;
    note: string;
    /** Un indirizzo per riga. */
    altre_fonti_url: string;
  };
  prezzi: PrezzoModulo[];
}

export interface SchedaDistanza {
  distanceId: string;
  raceId: string;
  paese: string;
  modulo: ModuloDistanza;
}

const CAMPI_PREZZO = [
  "edizione", "scaglione", "ordine", "prezzo", "valuta", "fonte_url", "fonte_tipo", "data_rilevazione",
  "include_iva", "include_commissioni",
] as const;

const testo = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const siNo = (v: unknown) => (v === true ? "si" : v === false ? "no" : "");

export async function leggiScheda(db: Pool | PoolClient, distanceId: string, perAggiornare = false): Promise<SchedaDistanza | null> {
  const blocco = perAggiornare ? " for update" : "";
  const { rows: righe } = await db.query(
    `select r.id as race_id, r.nome as race_nome, r.paese, r.regione, r.categoria, r.organizzatore, r.sito,
            r.qualifica_utmb, r.fonte_storico_url, d.id, d.nome, d.km, d.dplus, d.riferimento_nazionale, d.note,
            d.altre_fonti_url
     from distances d join races r on r.id = d.race_id where d.id = $1${blocco}`,
    [distanceId],
  );
  const r = righe[0];
  if (!r) return null;
  const { rows: prezzi } = await db.query(
    `select * from prices where distance_id = $1 order by edizione desc, scaglione, ordine${blocco}`,
    [distanceId],
  );
  return {
    distanceId: r.id,
    raceId: r.race_id,
    paese: r.paese,
    modulo: {
      gara: {
        nome: r.race_nome,
        regione: testo(r.regione),
        categoria: r.categoria,
        organizzatore: testo(r.organizzatore),
        sito: testo(r.sito),
        qualifica_utmb: siNo(r.qualifica_utmb),
        fonte_storico_url: testo(r.fonte_storico_url),
      },
      distanza: {
        nome: r.nome,
        km: testo(r.km),
        dplus: testo(r.dplus),
        riferimento_nazionale: siNo(r.riferimento_nazionale),
        note: testo(r.note),
        altre_fonti_url: (r.altre_fonti_url as string[]).join("\n"),
      },
      prezzi: prezzi.map((p) => ({
        id: Number(p.id),
        edizione: testo(p.edizione),
        scaglione: p.scaglione,
        ordine: testo(p.ordine),
        prezzo: testo(p.prezzo),
        valuta: p.valuta,
        fonte_url: testo(p.fonte_url),
        fonte_tipo: testo(p.fonte_tipo),
        data_rilevazione: testo(p.data_rilevazione),
        include_iva: siNo(p.include_iva),
        include_commissioni: siNo(p.include_commissioni),
        elimina: false,
      })),
    },
  };
}

/** Prezzo nuovo vuoto da offrire nel modulo. */
export function prezzoVuoto(valuta = ""): PrezzoModulo {
  return {
    id: null, edizione: "", scaglione: "standard", ordine: "1", prezzo: "", valuta, fonte_url: "", fonte_tipo: "",
    data_rilevazione: "", include_iva: "", include_commissioni: "", elimina: false,
  };
}

/**
 * Dal modulo inviato (nomi come "gara.regione", "distanza.km", "prezzo.12.prezzo", "prezzo.nuovo.prezzo",
 * "prezzo.12.elimina") alla struttura da salvare. Un prezzo nuovo senza importo viene ignorato. Funzione pura.
 */
export function leggiModulo(campi: Map<string, string>): ModuloDistanza {
  const v = (nome: string) => (campi.get(nome) ?? "").trim();
  const ids = new Set<string>();
  for (const nome of campi.keys()) {
    const m = nome.match(/^prezzo\.(\d+|nuovo)\./);
    if (m) ids.add(m[1]);
  }
  const prezzi: PrezzoModulo[] = [];
  for (const id of ids) {
    const p = Object.fromEntries(CAMPI_PREZZO.map((c) => [c, v(`prezzo.${id}.${c}`)])) as Record<(typeof CAMPI_PREZZO)[number], string>;
    if (id === "nuovo" && !p.prezzo) continue;
    prezzi.push({
      ...p,
      id: id === "nuovo" ? null : Number(id),
      valuta: p.valuta.toUpperCase(),
      ordine: p.ordine || "1",
      elimina: id !== "nuovo" && campi.has(`prezzo.${id}.elimina`),
    });
  }
  return {
    gara: {
      nome: v("gara.nome"),
      regione: v("gara.regione"),
      categoria: v("gara.categoria"),
      organizzatore: v("gara.organizzatore"),
      sito: v("gara.sito"),
      qualifica_utmb: v("gara.qualifica_utmb"),
      fonte_storico_url: v("gara.fonte_storico_url"),
    },
    distanza: {
      nome: v("distanza.nome"),
      km: v("distanza.km"),
      dplus: v("distanza.dplus"),
      riferimento_nazionale: v("distanza.riferimento_nazionale"),
      note: v("distanza.note"),
      altre_fonti_url: v("distanza.altre_fonti_url"),
    },
    prezzi,
  };
}

function eUrlHttps(t: string): boolean {
  try {
    return new URL(t).protocol === "https:";
  } catch {
    return false;
  }
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const eData = (t: string) => DATA_ISO.test(t) && new Date(`${t}T00:00:00Z`).toISOString().slice(0, 10) === t;
const SI_NO = ["", "si", "no"];

/** Errori che impediscono di salvare; vuoto = si può salvare. Stesse regole dell'approvazione. */
export function erroriModulo(m: ModuloDistanza, oggi: string): string[] {
  const errori: string[] = [];
  const { gara, distanza } = m;
  if (!gara.nome) errori.push("Manca il nome della gara.");
  if (!(CATEGORIE as readonly string[]).includes(gara.categoria)) errori.push(`Categoria "${gara.categoria}" non ammessa.`);
  if (!SI_NO.includes(gara.qualifica_utmb)) errori.push("Qualifica UTMB: sì, no o vuoto.");
  for (const [nome, url] of [["Sito", gara.sito], ["Fonte delle edizioni passate", gara.fonte_storico_url]]) {
    if (url && !eUrlHttps(url)) errori.push(`${nome}: serve un indirizzo https://.`);
  }
  if (!distanza.nome) errori.push("Manca il nome della distanza.");
  if (!(Number(distanza.km) > 0)) errori.push("km deve essere un numero maggiore di zero.");
  if (!(Number.isInteger(Number(distanza.dplus)) && Number(distanza.dplus) >= 0) || distanza.dplus === "") {
    errori.push("D+ deve essere un numero intero di metri.");
  }
  if (!["si", "no"].includes(distanza.riferimento_nazionale)) errori.push("Riferimento nazionale: sì o no.");
  for (const url of righe(distanza.altre_fonti_url)) if (!eUrlHttps(url)) errori.push(`Altra fonte non https: ${url}`);

  const restano = m.prezzi.filter((p) => !p.elimina);
  if (!restano.some((p) => Number(p.edizione) >= EDIZIONE_MINIMA)) {
    errori.push(`Serve almeno un prezzo dell'edizione ${EDIZIONE_MINIMA} o successive.`);
  }
  const chiavi = new Set<string>();
  for (const p of restano) {
    const quale = `Prezzo ${p.edizione || "?"} ${p.scaglione}`;
    if (!(Number.isInteger(Number(p.edizione)) && Number(p.edizione) >= 1900 && Number(p.edizione) <= 2100)) {
      errori.push(`${quale}: edizione non valida.`);
    }
    if (!(SCAGLIONI as readonly string[]).includes(p.scaglione)) errori.push(`${quale}: scaglione non ammesso.`);
    if (!(Number.isInteger(Number(p.ordine)) && Number(p.ordine) >= 1)) errori.push(`${quale}: ordine non valido.`);
    if (p.prezzo === "" || !(Number(p.prezzo) >= 0)) errori.push(`${quale}: importo non valido.`);
    if (!/^[A-Z]{3}$/.test(p.valuta)) errori.push(`${quale}: valuta di 3 lettere (EUR, GBP).`);
    if (!p.fonte_url || !eUrlHttps(p.fonte_url)) errori.push(`${quale}: serve la fonte, https://.`);
    if (!eFontePrimaria(p.fonte_tipo)) errori.push(`${quale}: solo fonti primarie (tipo di fonte "primaria…").`);
    if (!eData(p.data_rilevazione)) errori.push(`${quale}: data di verifica AAAA-MM-GG.`);
    else if (p.data_rilevazione > oggi) errori.push(`${quale}: data di verifica nel futuro.`);
    if (!SI_NO.includes(p.include_iva) || !SI_NO.includes(p.include_commissioni)) errori.push(`${quale}: IVA e commissioni sì, no o vuoto.`);
    const chiave = `${p.edizione} ${p.scaglione} ${p.ordine}`;
    if (chiavi.has(chiave)) errori.push(`${quale}: due prezzi con la stessa edizione, scaglione e ordine.`);
    chiavi.add(chiave);
  }
  return errori;
}

const righe = (t: string) => t.split(/\s+/).map((u) => u.trim()).filter(Boolean);
const daSiNo = (t: string) => (t === "si" ? true : t === "no" ? false : null);
const oNull = (t: string) => t || null;

/** Campi cambiati tra due schede, per la traccia in coda (es. "prezzo 2026 standard: prezzo 55 → 60"). */
export function differenze(prima: ModuloDistanza, dopo: ModuloDistanza): string[] {
  const out: string[] = [];
  for (const parte of ["gara", "distanza"] as const) {
    for (const [k, v] of Object.entries(dopo[parte])) {
      const vecchio = (prima[parte] as Record<string, string>)[k];
      if (vecchio !== v) out.push(`${parte}.${k}: ${vecchio || "—"} → ${v || "—"}`);
    }
  }
  const nome = (p: PrezzoModulo) => `prezzo ${p.edizione} ${p.scaglione}${p.ordine !== "1" ? ` ${p.ordine}` : ""}`;
  const primaPerId = new Map(prima.prezzi.map((p) => [p.id, p]));
  const dopoPerId = new Map(dopo.prezzi.map((p) => [p.id, p]));
  for (const p of prima.prezzi) if (!dopoPerId.has(p.id)) out.push(`${nome(p)}: eliminato`);
  for (const p of dopo.prezzi) {
    const v = primaPerId.get(p.id);
    if (!v) {
      out.push(`${nome(p)}: aggiunto (${p.prezzo} ${p.valuta})`);
      continue;
    }
    for (const c of CAMPI_PREZZO) if (v[c] !== p[c]) out.push(`${nome(p)}: ${c} ${v[c] || "—"} → ${p[c] || "—"}`);
  }
  return out;
}

/** Salva le correzioni di una distanza e lascia la traccia in coda. */
export async function salvaModifica(
  db: Pool,
  distanceId: string,
  modulo: ModuloDistanza,
  email: string,
  oggi: string,
): Promise<Esito> {
  const errori = erroriModulo(modulo, oggi);
  if (errori.length) return { ok: false, errori };

  const client = await db.connect();
  try {
    await client.query("begin");
    const prima = await leggiScheda(client, distanceId, true);
    if (!prima) {
      await client.query("rollback");
      return { ok: false, errori: ["Distanza non trovata."] };
    }
    const idEsistenti = new Set(prima.modulo.prezzi.map((p) => p.id));
    if (modulo.prezzi.some((p) => p.id !== null && !idEsistenti.has(p.id))) {
      await client.query("rollback");
      return { ok: false, errori: ["Un prezzo del modulo non appartiene a questa distanza: ricarica la pagina."] };
    }

    const { gara, distanza } = modulo;
    await client.query(
      `update races set nome = $2, regione = $3, categoria = $4, organizzatore = $5, sito = $6, qualifica_utmb = $7,
         fonte_storico_url = $8 where id = $1`,
      [prima.raceId, gara.nome, oNull(gara.regione), gara.categoria, oNull(gara.organizzatore), oNull(gara.sito),
        daSiNo(gara.qualifica_utmb) ?? false, oNull(gara.fonte_storico_url)],
    );
    await client.query(
      `update distances set nome = $2, km = $3, dplus = $4, riferimento_nazionale = $5, note = $6, altre_fonti_url = $7
       where id = $1`,
      [distanceId, distanza.nome, Number(Number(distanza.km).toFixed(2)), Number(distanza.dplus),
        distanza.riferimento_nazionale === "si", oNull(distanza.note), righe(distanza.altre_fonti_url)],
    );
    // Prima si eliminano, poi si aggiornano e si aggiungono. Il vincolo unico (edizione, scaglione, ordine) non è
    // rimandabile: scambiare le chiavi di due prezzi in un colpo solo dà errore (gestito sotto, con un messaggio).
    for (const p of modulo.prezzi.filter((x) => x.elimina)) {
      await client.query(`delete from prices where id = $1 and distance_id = $2`, [p.id, distanceId]);
    }
    const valori = (p: PrezzoModulo) => [
      Number(p.edizione), Number(p.prezzo), p.valuta, p.scaglione, Number(p.ordine), daSiNo(p.include_iva),
      daSiNo(p.include_commissioni), p.fonte_url, p.fonte_tipo, p.data_rilevazione,
    ];
    for (const p of modulo.prezzi.filter((x) => !x.elimina && x.id !== null)) {
      await client.query(
        `update prices set edizione = $3, prezzo = $4, valuta = $5, scaglione = $6, ordine = $7, include_iva = $8,
           include_commissioni = $9, fonte_url = $10, fonte_tipo = $11, data_rilevazione = $12
         where id = $1 and distance_id = $2`,
        [p.id, distanceId, ...valori(p)],
      );
    }
    for (const p of modulo.prezzi.filter((x) => x.id === null)) {
      await client.query(
        `insert into prices (distance_id, edizione, prezzo, valuta, scaglione, ordine, include_iva, include_commissioni,
           fonte_url, fonte_tipo, data_rilevazione)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [distanceId, ...valori(p)],
      );
    }

    const dopo = (await leggiScheda(client, distanceId))!;
    const cambiate = differenze(prima.modulo, dopo.modulo);
    if (cambiate.length) {
      await client.query(
        `insert into review_queue (origine, race_id, diff_testo, proposta, stato, chiuso_il, chiuso_da)
         values ('modifica_manuale', $1, $2, $3, 'approvata', now(), $4)`,
        [prima.raceId, cambiate.join("\n"), { chiave: distanceId, prima: prima.modulo, dopo: dopo.modulo }, email],
      );
    }
    await client.query("commit");
    return { ok: true };
  } catch (errore) {
    await client.query("rollback");
    if ((errore as { code?: string }).code === "23505") {
      return { ok: false, errori: ["Due prezzi con la stessa edizione, scaglione e ordine."] };
    }
    throw errore;
  } finally {
    client.release();
  }
}

export interface RigaElencoAdmin {
  distanceId: string;
  gara: string;
  distanza: string;
  paese: string;
  km: number;
  dplus: number;
  /** Ultimo prezzo standard (o l'ultimo in assoluto) con la sua data di verifica. */
  prezzo: string | null;
  verificato: string | null;
}

/** Elenco di tutte le distanze per la redazione, per gara. */
export async function elencoDistanze(db: Pool): Promise<RigaElencoAdmin[]> {
  const { rows } = await db.query(
    `select d.id, r.nome as gara, d.nome as distanza, r.paese, d.km, d.dplus, p.prezzo, p.valuta, p.edizione,
            p.scaglione, p.data_rilevazione
     from distances d join races r on r.id = d.race_id
     left join lateral (
       select * from prices where distance_id = d.id
       order by (scaglione = 'standard') desc, edizione desc, ordine limit 1
     ) p on true
     order by r.paese, r.nome, d.km`,
  );
  return rows.map((r) => ({
    distanceId: r.id,
    gara: r.gara,
    distanza: r.distanza,
    paese: r.paese,
    km: Number(r.km),
    dplus: Number(r.dplus),
    prezzo: r.prezzo === null ? null : `${r.prezzo} ${r.valuta} (${r.edizione} ${r.scaglione})`,
    verificato: r.data_rilevazione,
  }));
}
