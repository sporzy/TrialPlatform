// Filtri e ordine dell'elenco, e raggruppamento in schede per gara. Funzioni pure: niente calcoli nei componenti.
// Regole:
// - i filtri valgono per distanza; una gara compare se almeno una sua distanza passa, e mostra solo quelle;
// - si ordina sempre dentro ogni paese (una valuta per paese): mai confrontare € e £ (CLAUDE.md, "Valuta");
// - la chiave di una gara è il valore migliore tra le sue distanze visibili (minimo per costo e prezzo,
//   massimo per km e D+); le distanze senza prezzo standard non hanno fascia né costo e vanno in fondo.

import type { RigaElenco, SezionePaese } from "./elenco";
import type { Fascia } from "./metriche";
import { SOGLIE } from "./soglie";
import type { Categoria } from "./tipi";

export const LUNGHEZZE = ["corta", "media", "lunga"] as const;
export type Lunghezza = (typeof LUNGHEZZE)[number];

export const FASCE: Fascia[] = ["giusto", "sopra_soglia", "grandi_circuiti", "categoria_a_parte"];

export const ORDINI = ["costo", "prezzo", "km", "dplus", "nome"] as const;
export type Ordine = (typeof ORDINI)[number];

export interface Filtri {
  paese: string | null;
  lunghezze: Lunghezza[];
  fasce: Fascia[];
  /** Testo cercato, così come scritto (per rimetterlo nel modulo). */
  q: string;
  ordine: Ordine;
}

export const FILTRI_VUOTI: Filtri = { paese: null, lunghezze: [], fasce: [], q: "", ordine: "costo" };

export interface SchedaGara {
  raceId: string;
  gara: string;
  regione: string | null;
  categoria: Categoria;
  righe: RigaElenco[];
  /** Distanze della gara escluse dai filtri. */
  nascoste: number;
}

export interface SezioneFiltrata {
  paese: string;
  gare: SchedaGara[];
}

export interface Risultato {
  sezioni: SezioneFiltrata[];
  distanze: number;
  gare: number;
  /** Quante distanze ci sono in tutto per ogni opzione (per mostrare il numero e nascondere quelle vuote). */
  conteggi: {
    paese: Record<string, number>;
    lunghezza: Record<Lunghezza, number>;
    fascia: Record<Fascia, number>;
  };
}

type Parametri = Record<string, string | string[] | undefined>;

const lista = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Dai parametri dell'indirizzo ai filtri. Valori sconosciuti si ignorano: mai un errore per un link sbagliato. */
export function leggiFiltri(parametri: Parametri, paesi: readonly string[]): Filtri {
  const paese = lista(parametri.paese).find((p) => paesi.includes(p)) ?? null;
  const lunghezze = LUNGHEZZE.filter((l) => lista(parametri.lunghezza).includes(l));
  const fasce = FASCE.filter((f) => lista(parametri.fascia).includes(f));
  const q = (lista(parametri.q)[0] ?? "").trim().slice(0, 80);
  const ordine = ORDINI.find((o) => o === lista(parametri.ordine)[0]) ?? "costo";
  return { paese, lunghezze, fasce, q, ordine };
}

/** I filtri come parametri d'indirizzo (senza quelli vuoti né l'ordine predefinito), per link e selettore lingua. */
export function parametriFiltri(f: Filtri): URLSearchParams {
  const p = new URLSearchParams();
  if (f.paese) p.set("paese", f.paese);
  for (const l of f.lunghezze) p.append("lunghezza", l);
  for (const x of f.fasce) p.append("fascia", x);
  if (f.q) p.set("q", f.q);
  if (f.ordine !== "costo") p.set("ordine", f.ordine);
  return p;
}

export function filtriAttivi(f: Filtri): boolean {
  return Boolean(f.paese || f.lunghezze.length || f.fasce.length || f.q || f.ordine !== "costo");
}

/** Lunghezza in km reali: sotto 30 corta, da 30 a 80 compresi media, oltre 80 lunga. */
export function lunghezzaDi(km: number): Lunghezza {
  if (km < SOGLIE.kmGaraLunga) return "corta";
  return km <= SOGLIE.kmUltra ? "media" : "lunga";
}

/** Minuscole e senza accenti: "citta" trova "Città", "geants" trova "Géants". */
export function normalizza(testo: string): string {
  return testo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function passa(r: RigaElenco, f: Filtri, parole: string[]): boolean {
  if (f.lunghezze.length && !f.lunghezze.includes(lunghezzaDi(r.km))) return false;
  if (f.fasce.length && (r.fascia === null || !f.fasce.includes(r.fascia))) return false;
  if (parole.length) {
    const dove = normalizza(`${r.gara} ${r.distanza} ${r.regione ?? ""}`);
    if (!parole.every((p) => dove.includes(p))) return false;
  }
  return true;
}

// Per ogni ordine: chiave di una distanza (più piccola = prima) e come si combina tra le distanze di una gara.
const CHIAVE: Record<Exclude<Ordine, "nome">, (r: RigaElenco) => number> = {
  costo: (r) => r.costoKmSforzo ?? Infinity,
  prezzo: (r) => r.prezzo.prezzo,
  km: (r) => -r.km,
  dplus: (r) => -r.dplus,
};

function confronta(ordine: Ordine) {
  return (a: RigaElenco, b: RigaElenco) =>
    (ordine === "nome" ? 0 : CHIAVE[ordine](a) - CHIAVE[ordine](b)) ||
    (CHIAVE.costo(a) - CHIAVE.costo(b)) ||
    a.distanza.localeCompare(b.distanza, "it");
}

export function filtraElenco(sezioni: readonly SezionePaese[], f: Filtri): Risultato {
  const parole = normalizza(f.q).split(/\s+/).filter(Boolean);
  const conteggi: Risultato["conteggi"] = {
    paese: {},
    lunghezza: { corta: 0, media: 0, lunga: 0 },
    fascia: { giusto: 0, sopra_soglia: 0, grandi_circuiti: 0, categoria_a_parte: 0 },
  };
  for (const s of sezioni) {
    conteggi.paese[s.paese] = s.righe.length;
    for (const r of s.righe) {
      conteggi.lunghezza[lunghezzaDi(r.km)]++;
      if (r.fascia) conteggi.fascia[r.fascia]++;
    }
  }

  const ordina = confronta(f.ordine);
  const risultato = sezioni
    .filter((s) => !f.paese || s.paese === f.paese)
    .map((s): SezioneFiltrata => {
      const perGara = new Map<string, { tutte: RigaElenco[]; visibili: RigaElenco[] }>();
      for (const r of s.righe) {
        const g = perGara.get(r.raceId) ?? { tutte: [], visibili: [] };
        g.tutte.push(r);
        if (passa(r, f, parole)) g.visibili.push(r);
        perGara.set(r.raceId, g);
      }
      const gare = [...perGara.values()]
        .filter((g) => g.visibili.length)
        .map(({ tutte, visibili }): SchedaGara => {
          const righe = [...visibili].sort(ordina);
          const prima = righe[0];
          return {
            raceId: prima.raceId,
            gara: prima.gara,
            regione: prima.regione,
            categoria: prima.categoria,
            righe,
            nascoste: tutte.length - visibili.length,
          };
        })
        .sort((a, b) =>
          f.ordine === "nome"
            ? a.gara.localeCompare(b.gara, "it")
            : ordina(a.righe[0], b.righe[0]) || a.gara.localeCompare(b.gara, "it"),
        );
      return { paese: s.paese, gare };
    })
    .filter((s) => s.gare.length);

  return {
    sezioni: risultato,
    gare: risultato.reduce((n, s) => n + s.gare.length, 0),
    distanze: risultato.reduce((n, s) => n + s.gare.reduce((m, g) => m + g.righe.length, 0), 0),
    conteggi,
  };
}
