// Regole che non si rompono sui dati pubblicati (CLAUDE.md, "Dati"). Le usa l'approvazione in redazione
// (src/lib/admin/proposte.ts) e la landing (landing/dati.mjs): un solo posto, nessuna copia.

import en from "@/testi/en.json";

/** Solo prezzi ufficiali di questa edizione o successive. */
export const EDIZIONE_MINIMA = 2026;

/** Solo fonti primarie: il tipo di fonte di ogni prezzo deve cominciare così. */
export const PREFISSO_FONTE_PRIMARIA = "primaria";

/** Paesi che l'elenco sa mostrare (hanno il nome tradotto, "paese.XX" in src/testi/). */
export const PAESI = Object.keys(en)
  .filter((k) => k.startsWith("paese."))
  .map((k) => k.slice("paese.".length));

export function eFontePrimaria(fonteTipo: string | null | undefined): boolean {
  return (fonteTipo ?? "").trim().toLowerCase().startsWith(PREFISSO_FONTE_PRIMARIA);
}
