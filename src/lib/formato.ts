// Formattazione per l'interfaccia (it-IT). Si arrotonda solo qui, mai nei calcoli.

const numeri = new Map<number, Intl.NumberFormat>();

export function formatNumero(n: number, decimali = 0): string {
  let f = numeri.get(decimali);
  if (!f) {
    // useGrouping "always": in it-IT Intl non separa le migliaia sotto 10.000 ("9000"); in tabella serve "9.000".
    f = new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: decimali,
      maximumFractionDigits: decimali,
      useGrouping: "always",
    });
    numeri.set(decimali, f);
  }
  return f.format(n);
}

const km = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

/** Distanze con al massimo un decimale: 14.45 → "14,5", 120 → "120". */
export function formatKm(n: number): string {
  return km.format(n);
}

/** Importo nella valuta locale, mai convertito: 320.31 EUR → "320,31 €". */
export function formatValuta(n: number, valuta: string): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: valuta }).format(n);
}

/** Variazione percentuale con segno: −0,532 → "−53%", 0,45 → "+45%". */
export function formatPercentuale(n: number): string {
  const arrotondato = Math.round(n * 100);
  if (arrotondato === 0) return "0%";
  return `${arrotondato > 0 ? "+" : "−"}${Math.abs(arrotondato)}%`;
}
