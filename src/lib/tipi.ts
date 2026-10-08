// Modello dati (CLAUDE.md, "Modello dati"). Rispecchia db/migrations/0001_schema.sql:
// i valori ammessi qui sotto sono gli stessi dei vincoli CHECK, e un test li confronta.
// Il prezzo NON è un campo della gara né della distanza: è uno storico per edizione e scaglione.

export const CATEGORIE = ["piccola", "grande_circuito", "fell_race", "club"] as const;
export type Categoria = (typeof CATEGORIE)[number];

export const SCAGLIONI = ["early", "standard", "last", "lotteria"] as const;
export type Scaglione = (typeof SCAGLIONI)[number];

export const TIPI_COSTO_NASCOSTO = [
  "tesseramento",
  "crew",
  "requisito_indice",
  "navetta",
  "alloggio",
] as const;
export type TipoCostoNascosto = (typeof TIPI_COSTO_NASCOSTO)[number];

/** Una gara (evento). `id` è uno slug stabile, es. "it-adamello-ultra-trail". */
export interface Race {
  id: string;
  nome: string;
  /** Codice paese a 2 lettere, come nel CSV (es. "IT", "UK"). */
  paese: string;
  regione: string | null;
  organizzatore: string | null;
  sito: string | null;
  categoria: Categoria;
  qualificaUtmb: boolean;
  /** Punti ITRA, se noti. */
  itra: number | null;
}

/** Una distanza di una gara. `id` è uno slug stabile, es. "it-adamello-ultra-trail--aut-170". */
export interface Distance {
  id: string;
  raceId: string;
  nome: string;
  km: number;
  dplus: number;
  cancelli: string | null;
  materialeObbligatorio: string | null;
  gpxUrl: string | null;
  /** Distanza usata come riferimento nazionale (Lavaredo, UTS). */
  riferimentoNazionale: boolean;
  note: string | null;
}

/** Prezzo di una distanza per una edizione e uno scaglione, in valuta locale. */
export interface Price {
  distanceId: string;
  edizione: number;
  prezzo: number;
  /** Codice ISO 4217 (es. "EUR", "GBP"). Mai convertito. */
  valuta: string;
  scaglione: Scaglione;
  /** `null` = non verificato. */
  includeIva: boolean | null;
  /** `null` = non verificato. */
  includeCommissioni: boolean | null;
  fonteUrl: string | null;
  /** Data ISO (AAAA-MM-GG) in cui il prezzo è stato rilevato. */
  dataRilevazione: string | null;
}

/** Costo obbligatorio fuori dalla quota d'iscrizione (tesseramento, crew, ...). */
export interface HiddenCost {
  raceId: string;
  tipo: TipoCostoNascosto;
  descrizione: string;
  /** `null` se il costo non ha un importo fisso (es. crew obbligatoria). */
  importo: number | null;
  valuta: string | null;
}
