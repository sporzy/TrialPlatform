// Formattazione per l'interfaccia, nella convenzione della lingua (LOCALE in testi.ts).
// Si arrotonda solo qui, mai nei calcoli.

export interface Formato {
  numero(n: number, decimali?: number): string;
  /** Distanze con al massimo un decimale: 14.45 → "14,5", 120 → "120". */
  km(n: number): string;
  /** Importo nella valuta locale della gara, mai convertito: 320.31 EUR → "320,31 €". */
  valuta(n: number, valuta: string): string;
  /** Variazione percentuale con segno: −0,532 → "−53%", 0,45 → "+45%". */
  percentuale(n: number): string;
}

const formati = new Map<string, Formato>();

export function formato(locale: string): Formato {
  let f = formati.get(locale);
  if (!f) {
    f = creaFormato(locale);
    formati.set(locale, f);
  }
  return f;
}

function creaFormato(locale: string): Formato {
  const numeri = new Map<number, Intl.NumberFormat>();
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percentuale = new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "exceptZero",
    maximumFractionDigits: 0,
  });

  return {
    numero(n, decimali = 0) {
      let nf = numeri.get(decimali);
      if (!nf) {
        // useGrouping "always": in it-IT e es-ES Intl non separa le migliaia sotto 10.000 ("9000"); in tabella serve "9.000".
        nf = new Intl.NumberFormat(locale, {
          minimumFractionDigits: decimali,
          maximumFractionDigits: decimali,
          useGrouping: "always",
        });
        numeri.set(decimali, nf);
      }
      return nf.format(n);
    },
    km: (n) => km.format(n),
    valuta: (n, valuta) => new Intl.NumberFormat(locale, { style: "currency", currency: valuta }).format(n),
    // Il segno meno tipografico (−) anziché il trattino, in ogni lingua.
    percentuale: (n) => percentuale.format(n).replace("-", "−"),
  };
}
