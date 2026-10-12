// Righe della pagina elenco: per ogni distanza il prezzo corrente e le metriche.
// Tutti i calcoli passano da metriche.ts; qui si sceglie solo quali prezzi confrontare.

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
  prezzo: Price;
  costoKmSforzo: number;
  fascia: Fascia;
  /** Indice rispetto alla distanza di riferimento più simile; null se il paese non ne ha. */
  confronto: { riferimento: string; indice: number } | null;
  /** null se non c'è un prezzo di un'edizione precedente. */
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
        PRIORITA_SCAGLIONI.indexOf(a.scaglione) - PRIORITA_SCAGLIONI.indexOf(b.scaglione),
    )[0] ?? null
  );
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
    const prezzo = prezzoCorrente(prezziPerDistanza.get(d.id) ?? []);
    if (!gara || !prezzo) return [];
    const kmSf = kmSforzo(d.km, d.dplus);
    return [{ d, gara, prezzo, kmSf, costo: costoKmSforzo(prezzo.prezzo, kmSf) }];
  });

  const riferimenti = base
    .filter(({ d }) => d.riferimentoNazionale)
    .map(({ d, gara, prezzo, kmSf, costo }) => ({
      nome: `${gara.nome} ${etichettaDistanza(gara.nome, d.nome)}`.trim(),
      paese: gara.paese,
      valuta: prezzo.valuta,
      kmSforzo: kmSf,
      costoKmSforzo: costo,
    }));

  const righe = base.map(({ d, gara, prezzo, kmSf, costo }): { paese: string; riga: RigaElenco } => {
    const rif = scegliRiferimento({ paese: gara.paese, valuta: prezzo.valuta, kmSforzo: kmSf }, riferimenti);
    const precedente = prezzoPrecedente(prezziPerDistanza.get(d.id) ?? [], prezzo);
    const aumento = precedente ? aumentoYoy(confrontabile(prezzo, d), confrontabile(precedente, d)) : null;
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
      fascia: fasciaPrezzo(costo, d.km, gara.categoria),
      confronto: rif ? { riferimento: rif.nome, indice: indiceBenchmark(costo, rif.costoKmSforzo) } : null,
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
      .sort((a, b) => a.costoKmSforzo - b.costoKmSforzo || a.gara.localeCompare(b.gara, "it")),
  }));
}

// Il percorso non è storicizzato per edizione: km e D+ sono quelli attuali della distanza.
function confrontabile(p: Price, d: Distance) {
  return { ...p, km: d.km, dplus: d.dplus };
}
