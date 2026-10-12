// Importazione di data/gare.csv (generato da scripts/xlsx-a-csv.py) nel modello dati:
// gare, distanze e storico prezzi. Nessuna dipendenza; nessun accesso al file system qui.

import {
  CATEGORIE,
  SCAGLIONI,
  type Categoria,
  type Distance,
  type Price,
  type Race,
  type Scaglione,
} from "./tipi";

export const COLONNE_GARE = [
  "evento", "distanza", "paese", "zona", "categoria", "riferimento_nazionale",
  "edizione", "km", "dplus", "prezzo", "valuta", "scaglione",
  "prezzo_precedente", "edizione_precedente", "include_iva", "include_commissioni",
  "fonte_url", "altre_fonti_url", "fonte_storico_url", "fonte_prezzo_precedente_url",
  "fonte_tipo", "data_verifica", "note",
] as const;

type RigaGare = Record<(typeof COLONNE_GARE)[number], string>;

export interface DatiGare {
  races: Race[];
  distances: Distance[];
  prices: Price[];
}

/** Parser CSV (RFC 4180): virgolette, "" come virgoletta, virgole e a capo dentro i campi, CRLF. */
export function parseCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = "";
  let traVirgolette = false;

  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (traVirgolette) {
      if (c === '"' && testo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        traVirgolette = false;
      } else {
        campo += c;
      }
    } else if (c === '"' && campo === "") {
      traVirgolette = true;
    } else if (c === ",") {
      riga.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (traVirgolette) throw new Error("CSV non valido: virgolette non chiuse");
  if (campo !== "" || riga.length > 0) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe;
}

/** Slug stabile per gli id: minuscole, senza accenti, parole separate da "-". */
export function slug(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function importaGare(testo: string): DatiGare {
  const [intestazione, ...dati] = parseCsv(testo);
  if (intestazione?.join(",") !== COLONNE_GARE.join(",")) {
    throw new Error(`Intestazione di gare.csv inattesa: ${intestazione?.join(",")}`);
  }

  const races = new Map<string, Race>();
  const distances: Distance[] = [];
  const prices: Price[] = [];

  dati.forEach((valori, i) => {
    const dove = `gare.csv riga ${i + 2}`;
    if (valori.length !== COLONNE_GARE.length) {
      throw new Error(`${dove}: ${valori.length} campi invece di ${COLONNE_GARE.length}`);
    }
    const r = Object.fromEntries(COLONNE_GARE.map((c, j) => [c, valori[j].trim()])) as RigaGare;

    const categoria = valoreAmmesso(r.categoria, CATEGORIE, "categoria", dove) as Categoria;
    const raceId = slug(`${r.paese} ${r.evento}`);
    const esistente = races.get(raceId);
    if (esistente && esistente.categoria !== categoria) {
      throw new Error(`${dove}: categoria diversa dalle altre distanze di "${r.evento}"`);
    }
    if (!esistente) {
      races.set(raceId, {
        id: raceId,
        nome: r.evento,
        paese: r.paese,
        regione: r.zona || null,
        organizzatore: null,
        sito: null,
        categoria,
        // Non ancora nei dati: false = non indicata.
        qualificaUtmb: false,
        itra: null,
      });
    }

    const distanceId = `${raceId}--${slug(r.distanza)}`;
    if (distances.some((d) => d.id === distanceId)) {
      throw new Error(`${dove}: distanza duplicata (${distanceId})`);
    }
    distances.push({
      id: distanceId,
      raceId,
      nome: r.distanza,
      km: numero(r.km, "km", dove),
      dplus: numero(r.dplus, "dplus", dove),
      cancelli: null,
      materialeObbligatorio: null,
      gpxUrl: null,
      riferimentoNazionale: siNo(r.riferimento_nazionale, "riferimento_nazionale", dove) ?? false,
      note: r.note || null,
    });

    const base = {
      distanceId,
      valuta: r.valuta,
      scaglione: valoreAmmesso(r.scaglione, SCAGLIONI, "scaglione", dove) as Scaglione,
      includeIva: siNo(r.include_iva, "include_iva", dove),
      includeCommissioni: siNo(r.include_commissioni, "include_commissioni", dove),
      dataRilevazione: r.data_verifica || null,
      // Il CSV non ha ancora le validità degli scaglioni (arrivano con il foglio Edizioni).
      validoDal: null,
      validoFino: null,
      finoAIscritti: null,
      ordine: 1,
    };
    prices.push({
      ...base,
      edizione: numero(r.edizione, "edizione", dove),
      prezzo: numero(r.prezzo, "prezzo", dove),
      fonteUrl: r.fonte_url || null,
    });

    if (Boolean(r.prezzo_precedente) !== Boolean(r.edizione_precedente)) {
      throw new Error(`${dove}: prezzo_precedente ed edizione_precedente vanno indicati insieme`);
    }
    if (r.prezzo_precedente) {
      // Il CSV ha una sola colonna per scaglione, valuta e base: per il prezzo precedente
      // si assumono uguali a quelli attuali (lo dichiara l'Excel: "medesima categoria di iscrizione").
      prices.push({
        ...base,
        edizione: numero(r.edizione_precedente, "edizione_precedente", dove),
        prezzo: numero(r.prezzo_precedente, "prezzo_precedente", dove),
        fonteUrl: r.fonte_prezzo_precedente_url || null,
      });
    }
  });

  return { races: [...races.values()], distances, prices };
}

function numero(testo: string, campo: string, dove: string): number {
  const n = Number(testo);
  if (testo === "" || !Number.isFinite(n)) throw new Error(`${dove}: ${campo} non numerico ("${testo}")`);
  return n;
}

function siNo(testo: string, campo: string, dove: string): boolean | null {
  if (testo === "si") return true;
  if (testo === "no") return false;
  if (testo === "") return null;
  throw new Error(`${dove}: ${campo} deve essere "si", "no" o vuoto ("${testo}")`);
}

function valoreAmmesso(testo: string, ammessi: readonly string[], campo: string, dove: string): string {
  if (!ammessi.includes(testo)) throw new Error(`${dove}: ${campo} "${testo}" non ammesso`);
  return testo;
}
