// Modello dati (CLAUDE.md, "Modello dati"). Rispecchia db/migrations/ (0001, 0002):
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

/** Stati di un'edizione che non si deducono dalle date: li dichiara una fonte. */
export const STATI_MANUALI = ["sold_out", "annullata", "rinviata"] as const;
export type StatoManuale = (typeof STATI_MANUALI)[number];

export const FORMATI_FONTE = ["pagina", "pdf"] as const;
export type FormatoFonte = (typeof FORMATI_FONTE)[number];

export const ORIGINI_REVISIONE = ["cambio_fonte", "link_rotto", "nuova_gara", "segnalazione"] as const;
export type OrigineRevisione = (typeof ORIGINI_REVISIONE)[number];

export const STATI_REVISIONE = ["aperta", "approvata", "scartata"] as const;
export type StatoRevisione = (typeof STATI_REVISIONE)[number];

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
  /** Primo giorno di validità dello scaglione (data ISO), `null` se non dichiarato. */
  validoDal: string | null;
  /** Ultimo giorno di validità dello scaglione (data ISO, incluso), `null` se non dichiarato. */
  validoFino: string | null;
  /** Scaglione valido fino ai primi N iscritti: non calcolabile senza una fonte. */
  finoAIscritti: number | null;
  /** Distingue più scaglioni con lo stesso nome (early 1, early 2). Parte da 1. */
  ordine: number;
}

/**
 * Edizione di una gara (gara × anno). Tutte le date sono ISO (AAAA-MM-GG) e facoltative:
 * `null` = non ancora annunciata o non verificata. Lo stato delle iscrizioni si calcola dalle date.
 */
export interface Edition {
  raceId: string;
  anno: number;
  dataGara: string | null;
  /** Solo per le gare su più giorni. */
  dataGaraFine: string | null;
  iscrizioniApertura: string | null;
  iscrizioniChiusura: string | null;
  lotteriaApertura: string | null;
  lotteriaChiusura: string | null;
  lotteriaEsito: string | null;
  /** Pagina d'iscrizione di questa edizione (https). */
  urlIscrizione: string | null;
  postiMax: number | null;
  /** Impostato solo da una fonte, mai dedotto. */
  statoManuale: StatoManuale | null;
  fonteUrl: string | null;
  dataVerifica: string | null;
}

/** Pagina o PDF ufficiale controllato dal job notturno. */
export interface Source {
  id: number;
  raceId: string;
  url: string;
  formato: FormatoFonte;
  ultimoHash: string | null;
  /** Timestamp ISO. */
  ultimoControllo: string | null;
  /** Timestamp ISO. */
  ultimoCambiamento: string | null;
  /** Ultimo errore (404, timeout, redirect); `null` se l'ultimo controllo è andato bene. */
  errore: string | null;
}

/** Valore proposto dal job, con la citazione esatta dal testo della fonte. */
export interface ValoreProposto<T> {
  valore: T;
  citazione: string;
}

/** Voce della coda di revisione: niente viene pubblicato senza approvazione. */
export interface ReviewItem {
  id: number;
  origine: OrigineRevisione;
  raceId: string | null;
  sourceId: number | null;
  diffTesto: string | null;
  proposta: Record<string, ValoreProposto<unknown>> | null;
  stato: StatoRevisione;
  /** Timestamp ISO. */
  creatoIl: string;
  /** Timestamp ISO; `null` finché la voce è aperta. */
  chiusoIl: string | null;
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
