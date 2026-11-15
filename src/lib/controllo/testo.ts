// Dal contenuto di una pagina alle righe che contano, e i confronti tra una notte e l'altra. Funzioni pure.

const ENTITA: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", euro: "€", pound: "£",
  egrave: "è", eacute: "é", agrave: "à", ograve: "ò", ugrave: "ù", igrave: "ì", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", middot: "·", deg: "°",
};

function decodifica(testo: string): string {
  return testo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tutto, codice: string) => {
    if (codice[0] === "#") {
      const n = codice[1].toLowerCase() === "x" ? parseInt(codice.slice(2), 16) : parseInt(codice.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : tutto;
    }
    return ENTITA[codice.toLowerCase()] ?? tutto;
  });
}

/** Testo leggibile di una pagina HTML: niente script, stili né tag; una riga per blocco. */
export function testoDaHtml(html: string): string {
  const senza = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|td|th|h[1-6]|section|article|header|footer|table|ul|ol|dt|dd|option|label)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodifica(senza)
    .split("\n")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// Una riga conta se parla di prezzi, iscrizioni, distanze o dislivello.
const UTILE = /[€£]|\b(eur|euro|gbp|quota|quote|prezz|iscrizion|tariff|costo|fee|fees|entry|entries|price|prices|early|late|standard|scaglion|km\b|chilometr|dislivell|d\+|elevation|ascent|miles?\b)/i;

// Cose che cambiano da sole e non sono notizie: contatori, orari, banner dei cookie, posti rimasti.
const VOLATILE = [
  /\b(posti|places|spaces|spots|entries)\s+(rimast|left|remaining|available|disponibil)/i,
  /\b(rimangono|remaining|left)\s*:?\s*\d+/i,
  /\b\d+\s*(posti|places|spaces|spots)\b/i,
  /\b(iscritti|registered|entrants|runners entered|entries)\s*:?\s*\d+(?![\d.,]*\s*[€£])/i,
  /\b\d{1,2}:\d{2}(:\d{2})?\b.*\b(fa|ago|aggiornato|updated)\b/i,
  /\b(cookie|privacy policy|gdpr)\b/i,
];

const LUNGHEZZA_MASSIMA = 400;

/** Righe che contano, senza doppioni e in ordine: è ciò che si confronta notte per notte. */
export function righeUtili(testo: string): string[] {
  const viste = new Set<string>();
  const righe: string[] = [];
  for (const riga of testo.split("\n")) {
    const r = riga.trim().slice(0, LUNGHEZZA_MASSIMA);
    if (!r || !UTILE.test(r) || VOLATILE.some((v) => v.test(r)) || viste.has(r)) continue;
    viste.add(r);
    righe.push(r);
  }
  return righe;
}

/** Righe tolte e aggiunte tra due versioni (al più `limite` per parte, per una voce di coda leggibile). */
export function confrontaRighe(prima: string[], dopo: string[], limite = 30): { tolte: string[]; aggiunte: string[] } {
  const a = new Set(prima);
  const b = new Set(dopo);
  return {
    tolte: prima.filter((r) => !b.has(r)).slice(0, limite),
    aggiunte: dopo.filter((r) => !a.has(r)).slice(0, limite),
  };
}

const SIMBOLI: Record<string, string> = { EUR: "(?:€|eur|euro)", GBP: "(?:£|gbp)" };

/** Modi in cui un importo può essere scritto: 55 · 55,00 · 55.00 · 119,9 → 119,90 · 1.200 o 1,200. */
function formeImporto(prezzo: number): string[] {
  const due = prezzo.toFixed(2);
  const [intera, decimali] = due.split(".");
  const conMigliaia = (sep: string) => intera.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const forme = new Set<string>();
  for (const migliaia of ["", ".", ",", " "]) {
    const i = conMigliaia(migliaia);
    for (const dec of [",", "."]) {
      if (dec === migliaia) continue;
      forme.add(`${i}${dec}${decimali}`);
      if (decimali === "00") forme.add(i);
      else if (decimali.endsWith("0")) forme.add(`${i}${dec}${decimali[0]}`);
    }
  }
  return [...forme].sort((x, y) => y.length - x.length);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * L'importo compare nella pagina vicino al simbolo della sua valuta (prima o dopo), come numero intero
 * e non come parte di un altro numero. Valute senza simbolo noto: si cerca accanto al codice ISO.
 */
export function prezzoPresente(testo: string, prezzo: number, valuta: string): boolean {
  const simbolo = SIMBOLI[valuta] ?? escape(valuta);
  const importo = `(?:${formeImporto(prezzo).map(escape).join("|")})`;
  // Dopo l'importo non deve continuare un numero: né una cifra, né un separatore seguito da cifre.
  const fine = "(?!\\d)(?![.,]\\d)";
  const prima = new RegExp(`${simbolo}\\s{0,2}${importo}${fine}`, "i");
  const dopo = new RegExp(`(?<![\\d.,])${importo}${fine}\\s{0,2}${simbolo}`, "i");
  return prima.test(testo) || dopo.test(testo);
}
