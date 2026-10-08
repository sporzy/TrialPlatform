// Unico punto in cui si calcolano le metriche (CLAUDE.md, "Metriche").
// Solo funzioni pure: nessun arrotondamento qui, si arrotonda in visualizzazione.
// Tutti i valori monetari sono in valuta locale: nessuna funzione converte valute.

import { SOGLIE } from "./soglie";
import type { Categoria, Scaglione } from "./tipi";

// Tolleranza per i confronti con le soglie, così 1,2 calcolato come 1,2000000000000002 resta "≤ 1,20".
const EPSILON = 1e-9;

/** km-sforzo = km + D+ / 100 (es. 50 km con 3.000 m D+ = 80). */
export function kmSforzo(km: number, dplus: number): number {
  if (!(km > 0)) throw new RangeError(`km deve essere > 0 (ricevuto ${km})`);
  if (!(dplus >= 0)) throw new RangeError(`D+ deve essere ≥ 0 (ricevuto ${dplus})`);
  return km + dplus / 100;
}

/** Costo per km-sforzo = prezzo / km-sforzo, in valuta locale. */
export function costoKmSforzo(prezzo: number, kmSf: number): number {
  if (!(prezzo >= 0)) throw new RangeError(`prezzo deve essere ≥ 0 (ricevuto ${prezzo})`);
  if (!(kmSf > 0)) throw new RangeError(`km-sforzo deve essere > 0 (ricevuto ${kmSf})`);
  return prezzo / kmSf;
}

/** Indice rispetto al riferimento: −0,53 significa "53% in meno del riferimento". */
export function indiceBenchmark(costo: number, costoRiferimento: number): number {
  if (!(costoRiferimento > 0)) {
    throw new RangeError(`costo del riferimento deve essere > 0 (ricevuto ${costoRiferimento})`);
  }
  return costo / costoRiferimento - 1;
}

export interface Riferimento {
  paese: string;
  valuta: string;
  kmSforzo: number;
  costoKmSforzo: number;
}

/**
 * Regola del riferimento nazionale, uguale per tutti i paesi: tra le distanze di riferimento
 * dello stesso paese e della stessa valuta, quella più vicina in km-sforzo.
 * A parità di distanza vince la prima dell'elenco. `null` se il paese non ha riferimenti.
 */
export function scegliRiferimento<R extends Riferimento>(
  distanza: { paese: string; valuta: string; kmSforzo: number },
  riferimenti: readonly R[],
): R | null {
  let migliore: R | null = null;
  for (const r of riferimenti) {
    if (r.paese !== distanza.paese || r.valuta !== distanza.valuta) continue;
    if (
      migliore === null ||
      Math.abs(r.kmSforzo - distanza.kmSforzo) < Math.abs(migliore.kmSforzo - distanza.kmSforzo)
    ) {
      migliore = r;
    }
  }
  return migliore;
}

export interface PrezzoConfrontabile {
  prezzo: number;
  valuta: string;
  scaglione: Scaglione;
  /** `null` = non verificato. */
  includeIva: boolean | null;
  /** `null` = non verificato. */
  includeCommissioni: boolean | null;
  km: number;
  dplus: number;
}

export type EsitoAumento =
  | { tipo: "prezzo"; valore: number }
  | { tipo: "percorso_modificato"; valore: number }
  | { tipo: "non_confrontabile"; motivo: "valuta" | "scaglione" | "base" };

/**
 * Aumento anno su anno. Si confronta solo stessa valuta, stesso scaglione e stessa base
 * (IVA e commissioni): due valori "non verificato" contano come stessa base.
 * Se km o D+ cambiano si confronta il costo per km-sforzo ("percorso modificato").
 */
export function aumentoYoy(
  attuale: PrezzoConfrontabile,
  precedente: PrezzoConfrontabile,
): EsitoAumento {
  if (attuale.valuta !== precedente.valuta) return { tipo: "non_confrontabile", motivo: "valuta" };
  if (attuale.scaglione !== precedente.scaglione) {
    return { tipo: "non_confrontabile", motivo: "scaglione" };
  }
  if (
    attuale.includeIva !== precedente.includeIva ||
    attuale.includeCommissioni !== precedente.includeCommissioni
  ) {
    return { tipo: "non_confrontabile", motivo: "base" };
  }

  if (attuale.km !== precedente.km || attuale.dplus !== precedente.dplus) {
    const costoAttuale = costoKmSforzo(attuale.prezzo, kmSforzo(attuale.km, attuale.dplus));
    const costoPrecedente = costoKmSforzo(precedente.prezzo, kmSforzo(precedente.km, precedente.dplus));
    return { tipo: "percorso_modificato", valore: costoAttuale / costoPrecedente - 1 };
  }
  return { tipo: "prezzo", valore: attuale.prezzo / precedente.prezzo - 1 };
}

export type Fascia = "giusto" | "sopra_soglia" | "grandi_circuiti" | "categoria_a_parte";

/**
 * Fascia del costo per km-sforzo:
 * - fell race e gare di club → categoria a parte (abbassano le medie);
 * - ≤ soglia (1,00 se ≥ 30 km, 1,20 se < 30 km) → costa il giusto;
 * - fino a 1,50 → sopra soglia;
 * - oltre 1,50 → fascia grandi circuiti.
 */
export function fasciaPrezzo(costo: number, km: number, categoria: Categoria): Fascia {
  if (categoria === "fell_race" || categoria === "club") return "categoria_a_parte";
  const soglia = km >= SOGLIE.kmGaraLunga ? SOGLIE.costoGiustoGaraLunga : SOGLIE.costoGiustoGaraCorta;
  if (costo <= soglia + EPSILON) return "giusto";
  if (costo <= SOGLIE.limiteGrandiCircuiti + EPSILON) return "sopra_soglia";
  return "grandi_circuiti";
}

/** Badge rosso se l'aumento anno su anno supera +15%; altrimenti nessun badge. */
export function badgeAumento(esito: EsitoAumento): "rosso" | null {
  if (esito.tipo === "non_confrontabile") return null;
  return esito.valore > SOGLIE.aumentoRosso + EPSILON ? "rosso" : null;
}
