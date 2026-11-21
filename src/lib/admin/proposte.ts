// Proposte di gare nuove (coda di revisione, origine "nuova_gara"): una riga con le stesse colonne del vecchio
// CSV, che la redazione completa e approva. Qui le regole che prima applicava lo script dell'Excel:
// niente si pubblica se manca una fonte primaria, un prezzo 2026+ o un dato obbligatorio. Funzioni pure.

import { COLONNE_PROPOSTA, convertiRiga, type DatiRiga, type RigaProposta } from "../importa-csv";
import { EDIZIONE_MINIMA, eFontePrimaria, PAESI } from "../regole";
import { CATEGORIE, SCAGLIONI } from "../tipi";

export type Campo = (typeof COLONNE_PROPOSTA)[number];

const OBBLIGATORI: Campo[] = [
  "evento", "distanza", "paese", "categoria", "edizione", "km", "dplus", "prezzo", "valuta", "scaglione",
  "fonte_url", "fonte_tipo", "data_verifica",
];
const URL_FACOLTATIVI: Campo[] = ["sito", "altre_fonti_url", "fonte_storico_url", "fonte_prezzo_precedente_url"];

export function rigaVuota(): RigaProposta {
  return Object.fromEntries(COLONNE_PROPOSTA.map((c) => [c, ""])) as RigaProposta;
}

/**
 * Da quello che arriva (modulo, proposta salvata) a una riga pulita: solo le colonne note, testo senza spazi ai lati,
 * paese e valuta in maiuscolo, km a 2 decimali e D+ al metro (CLAUDE.md). I valori non numerici restano come sono:
 * li segnala la validazione.
 */
export function normalizzaRiga(dati: Record<string, unknown> | null | undefined): RigaProposta {
  const riga = rigaVuota();
  for (const c of COLONNE_PROPOSTA) {
    const v = dati?.[c];
    riga[c] = v === null || v === undefined ? "" : String(v).trim();
  }
  riga.paese = riga.paese.toUpperCase();
  riga.valuta = riga.valuta.toUpperCase();
  riga.km = arrotonda(riga.km, 2);
  riga.dplus = arrotonda(riga.dplus, 0);
  return riga;
}

function arrotonda(testo: string, decimali: number): string {
  const n = Number(testo.replace(",", "."));
  if (testo === "" || !Number.isFinite(n)) return testo;
  return String(Number(n.toFixed(decimali)));
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function eDataValida(testo: string): boolean {
  if (!DATA_ISO.test(testo)) return false;
  const d = new Date(`${testo}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === testo;
}

function eUrlHttps(testo: string): boolean {
  try {
    return new URL(testo).protocol === "https:";
  } catch {
    return false;
  }
}

/** Errori che impediscono di pubblicare la riga; vuoto = si può approvare. `oggi` è una data ISO. */
export function erroriPubblicazione(r: RigaProposta, oggi: string): string[] {
  const errori: string[] = [];
  for (const c of OBBLIGATORI) if (!r[c]) errori.push(`Manca ${c}.`);

  if (r.paese && !PAESI.includes(r.paese)) {
    errori.push(`Paese "${r.paese}" non ancora gestito dall'elenco (ammessi: ${PAESI.join(", ")}): servono prima i testi tradotti.`);
  }
  if (r.categoria && !(CATEGORIE as readonly string[]).includes(r.categoria)) {
    errori.push(`Categoria "${r.categoria}" non ammessa (${CATEGORIE.join(", ")}).`);
  }
  if (r.scaglione && !(SCAGLIONI as readonly string[]).includes(r.scaglione)) {
    errori.push(`Scaglione "${r.scaglione}" non ammesso (${SCAGLIONI.join(", ")}).`);
  }
  if (r.valuta && !/^[A-Z]{3}$/.test(r.valuta)) errori.push(`Valuta "${r.valuta}" non valida: codice di 3 lettere (EUR, GBP).`);

  if (r.fonte_tipo && !eFontePrimaria(r.fonte_tipo)) {
    errori.push(`Solo fonti primarie: il tipo di fonte deve cominciare con "primaria" (ora: "${r.fonte_tipo}").`);
  }
  if (r.fonte_url && !eUrlHttps(r.fonte_url)) errori.push("fonte_url deve essere un indirizzo https://.");
  for (const c of URL_FACOLTATIVI) if (r[c] && !eUrlHttps(r[c])) errori.push(`${c} deve essere un indirizzo https://.`);

  const edizione = Number(r.edizione);
  if (r.edizione && !(Number.isInteger(edizione) && edizione >= EDIZIONE_MINIMA && edizione <= 2100)) {
    errori.push(`Solo prezzi ufficiali dell'edizione ${EDIZIONE_MINIMA} o successive (ora: "${r.edizione}").`);
  }
  if (Boolean(r.prezzo_precedente) !== Boolean(r.edizione_precedente)) {
    errori.push("Prezzo precedente ed edizione precedente vanno indicati insieme.");
  } else if (r.edizione_precedente && !(Number(r.edizione_precedente) < edizione)) {
    errori.push("L'edizione precedente deve venire prima dell'edizione del prezzo.");
  }

  if (r.km && !(Number(r.km) > 0)) errori.push("km deve essere un numero maggiore di zero.");
  if (r.dplus && !(Number.isInteger(Number(r.dplus)) && Number(r.dplus) >= 0)) errori.push("dplus deve essere un numero di metri.");
  if (r.prezzo && !(Number(r.prezzo) >= 0)) errori.push("prezzo deve essere un numero.");

  if (r.data_verifica && !eDataValida(r.data_verifica)) errori.push("data_verifica deve essere una data AAAA-MM-GG.");
  else if (r.data_verifica && r.data_verifica > oggi) errori.push("data_verifica non può essere nel futuro.");

  // Ultimo controllo: la stessa conversione dei dati importati (sì/no, numeri, valori ammessi).
  if (!errori.length) {
    try {
      convertiRiga(r, "proposta");
    } catch (e) {
      errori.push((e as Error).message);
    }
  }
  return errori;
}

/** Gara, distanza e prezzi da pubblicare, oppure gli errori che lo impediscono. */
export function datiDaPubblicare(r: RigaProposta, oggi: string): { dati: DatiRiga; errori: [] } | { dati: null; errori: string[] } {
  const errori = erroriPubblicazione(r, oggi);
  if (errori.length) return { dati: null, errori };
  return { dati: convertiRiga(r, "proposta"), errori: [] };
}

/** Data di oggi (AAAA-MM-GG) in Italia, dove lavora la redazione. */
export function oggiInItalia(ora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(ora);
}
