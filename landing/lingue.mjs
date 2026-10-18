// Lingue della landing, condivise dalla generazione delle pagine (build.mjs) e dal Worker.

export const LINGUE = ["it", "en", "fr", "de", "es"];

// L'italiano sta alla radice (fairkm.com/), le altre lingue in /en/, /fr/, ...
export const PREDEFINITA = "it";

// Lingua in cui si scrivono i testi: le altre devono avere le stesse chiavi (build.mjs).
export const RIFERIMENTO = "en";

// Per chi ha il browser in una lingua che non abbiamo.
export const RISERVA = "en";

export const COOKIE = "lang";

export function percorso(lingua) {
  return lingua === PREDEFINITA ? "/" : `/${lingua}/`;
}

export function linguaDaCookie(intestazione) {
  for (const parte of (intestazione ?? "").split(";")) {
    const [nome, valore] = parte.trim().split("=");
    if (nome === COOKIE && LINGUE.includes(valore)) return valore;
  }
  return null;
}

// Prima lingua supportata fra quelle del browser, in ordine di preferenza (q).
// Senza intestazione (es. i motori di ricerca) si resta sulla lingua predefinita.
export function linguaDaBrowser(acceptLanguage) {
  if (!acceptLanguage || !acceptLanguage.trim()) return PREDEFINITA;
  const preferenze = acceptLanguage
    .split(",")
    .map((voce, ordine) => {
      const [tag, ...parametri] = voce.trim().split(";");
      const q = parametri.find((p) => p.trim().startsWith("q="));
      return { base: tag.split("-")[0].toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1, ordine };
    })
    .filter((p) => p.base && p.base !== "*" && p.q > 0)
    .sort((a, b) => b.q - a.q || a.ordine - b.ordine);
  return preferenze.find((p) => LINGUE.includes(p.base))?.base ?? RISERVA;
}

export function scegliLingua(cookie, acceptLanguage) {
  return linguaDaCookie(cookie) ?? linguaDaBrowser(acceptLanguage);
}
