// Righe della pagina elenco: per ogni distanza il prezzo corrente e le metriche.
// Tutti i calcoli passano da metriche.ts; qui si sceglie solo quali prezzi confrontare.
// Regola (CLAUDE.md): costo, fascia, indice e aumento si calcolano solo sul prezzo standard.
// Se una distanza non ha un prezzo standard si mostra quello che c'è, con il suo scaglione, senza metriche.

import type { DatiGare } from "./importa-csv";
import {
  aumentoYoy,
  badgeAumento,
  costoKmSforzo,
  fasciaPrezzo,
  indiceBenchmark,
  kmSforzo,
  scegliRiferimento,
  type EsitoAumento,
  type Fascia,
} from "./metriche";
import type { Categoria, Distance, Price, Scaglione } from "./tipi";

const NOMI_PAESI: Record<string, string> = { IT: "Italia", UK: "Regno Unito" };

// A parità di edizione si mostra lo scaglione standard; gli altri solo se manca, e indicati.
const PRIORITA_SCAGLIONI: Scaglione[] = ["standard", "early", "last", "lotteria"];

export interface RigaElenco {
  distanceId: string;
  gara: string;
  /** Nome della distanza senza ripetere il nome della gara; "" se coincide. */
  distanza: string;
  regione: string | null;
  categoria: Categoria;
  riferimentoNazionale: boolean;
  km: number;
  dplus: number;
  kmSforzo: number;
  /** Prezzo mostrato: lo standard se c'è, altrimenti il più recente disponibile. */
  prezzo: Price;
  /** Calcolato sul prezzo standard; null se manca. */
  costoKmSforzo: number | null;
  /** Calcolata sul prezzo standard; null se manca. */
  fascia: Fascia | null;
  /** Indice rispetto alla distanza di riferimento più simile; null senza prezzo standard o riferimenti. */
  confronto: { riferimento: string; indice: number } | null;
  /** Prezzo standard rispetto all'edizione precedente; null se manca uno dei due. */
  aumento: EsitoAumento | null;
  badgeAumento: "rosso" | null;
}

export interface SezionePaese {
  paese: string;
  nomePaese: string;
  righe: RigaElenco[];
}

/** Prezzo corrente: l'edizione più recente, con lo scaglione standard se c'è. */
export function prezzoCorrente(prezzi: readonly Price[]): Price | null {
  return (
    [...prezzi].sort(
      (a, b) =>
        b.edizione - a.edizione ||
        PRIORITA_SCAGLIONI.indexOf(a.scaglione) - PRIORITA_SCAGLIONI.indexOf(b.scaglione) ||
        a.ordine - b.ordine,
    )[0] ?? null
  );
}

/** Prezzo standard dell'edizione più recente che ne ha uno (a parità, ordine più basso). */
export function prezzoStandard(prezzi: readonly Price[]): Price | null {
  return prezzoCorrente(prezzi.filter((p) => p.scaglione === "standard"));
}

/** Prezzo con cui calcolare l'aumento: l'edizione precedente più recente, stesso scaglione se c'è. */
export function prezzoPrecedente(prezzi: readonly Price[], corrente: Price): Price | null {
  const precedenti = prezzi.filter((p) => p.edizione < corrente.edizione);
  if (precedenti.length === 0) return null;
  const edizione = Math.max(...precedenti.map((p) => p.edizione));
  const candidati = precedenti.filter((p) => p.edizione === edizione);
  return candidati.find((p) => p.scaglione === corrente.scaglione) ?? candidati[0];
}

/** "Trail del Drago" + "Trail del Drago 10K" → "10K"; nome uguale alla gara → "". */
export function etichettaDistanza(gara: string, distanza: string): string {
  if (distanza === gara) return "";
  if (distanza.startsWith(`${gara} `)) return distanza.slice(gara.length + 1);
  return distanza;
}

export function costruisciElenco(dati: DatiGare): SezionePaese[] {
  const gare = new Map(dati.races.map((r) => [r.id, r]));
  const prezziPerDistanza = new Map<string, Price[]>();
  for (const p of dati.prices) {
    prezziPerDistanza.set(p.distanceId, [...(prezziPerDistanza.get(p.distanceId) ?? []), p]);
  }

  const base = dati.distances.flatMap((d) => {
    const gara = gare.get(d.raceId);
    const prezzi = prezziPerDistanza.get(d.id) ?? [];
    const standard = prezzoStandard(prezzi);
    const prezzo = standard ?? prezzoCorrente(prezzi);
    if (!gara || !prezzo) return [];
    const kmSf = kmSforzo(d.km, d.dplus);
    return [{ d, gara, prezzi, prezzo, standard, kmSf, costo: standard ? costoKmSforzo(standard.prezzo, kmSf) : null }];
  });

  const riferimenti = base.flatMap(({ d, gara, prezzo, kmSf, costo }) =>
    d.riferimentoNazionale && costo !== null
      ? [{
          nome: `${gara.nome} ${etichettaDistanza(gara.nome, d.nome)}`.trim(),
          paese: gara.paese,
          valuta: prezzo.valuta,
          kmSforzo: kmSf,
          costoKmSforzo: costo,
        }]
      : [],
  );

  const righe = base.map(({ d, gara, prezzi, prezzo, standard, kmSf, costo }): { paese: string; riga: RigaElenco } => {
    const rif =
      costo === null ? null : scegliRiferimento({ paese: gara.paese, valuta: prezzo.valuta, kmSforzo: kmSf }, riferimenti);
    const precedente = standard ? prezzoPrecedente(prezzi, standard) : null;
    const aumento =
      standard && precedente ? aumentoYoy(confrontabile(standard, d), confrontabile(precedente, d)) : null;
    const riga: RigaElenco = {
      distanceId: d.id,
      gara: gara.nome,
      distanza: etichettaDistanza(gara.nome, d.nome),
      regione: gara.regione,
      categoria: gara.categoria,
      riferimentoNazionale: d.riferimentoNazionale,
      km: d.km,
      dplus: d.dplus,
      kmSforzo: kmSf,
      prezzo,
      costoKmSforzo: costo,
      fascia: costo === null ? null : fasciaPrezzo(costo, d.km, gara.categoria),
      confronto:
        rif && costo !== null ? { riferimento: rif.nome, indice: indiceBenchmark(costo, rif.costoKmSforzo) } : null,
      aumento,
      badgeAumento: aumento ? badgeAumento(aumento) : null,
    };
    return { paese: gara.paese, riga };
  });

  const paesi = [...new Set(righe.map((r) => r.paese))].sort(
    (a, b) => (NOMI_PAESI[a] ?? a).localeCompare(NOMI_PAESI[b] ?? b, "it"),
  );
  return paesi.map((paese) => ({
    paese,
    nomePaese: NOMI_PAESI[paese] ?? paese,
    righe: righe
      .filter((r) => r.paese === paese)
      .map((r) => r.riga)
      // Senza prezzo standard in fondo.
      .sort(
        (a, b) =>
          (a.costoKmSforzo ?? Infinity) - (b.costoKmSforzo ?? Infinity) || a.gara.localeCompare(b.gara, "it"),
      ),
  }));
}

// Il percorso non è storicizzato per edizione: km e D+ sono quelli attuali della distanza.
function confrontabile(p: Price, d: Distance) {
  return { ...p, km: d.km, dplus: d.dplus };
}
