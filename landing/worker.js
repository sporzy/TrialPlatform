// Davanti alle pagine statiche: www → dominio principale, scelta della lingua su "/",
// iscrizione all'avviso di apertura (/api/iscrizione) e inoltro all'app delle gare (/races/, /it/races/, ...).
import { iscrivi } from "./iscrizione.mjs";
import { CARTELLA_GARE, COOKIE, LINGUE, PREDEFINITA, percorso, scegliLingua } from "./lingue.mjs";

const UN_ANNO = 60 * 60 * 24 * 365;

// Percorsi dell'app delle gare (Next.js su Render): /races/..., /<lingua>/races/... e i suoi file in /_next/.
const GARE = new RegExp(`^/(?:(?:${LINGUE.join("|")})/)?${CARTELLA_GARE}(?:/|$)`);

export function eDellApp(pathname) {
  return GARE.test(pathname) || pathname.startsWith("/_next/");
}

// Inoltra la richiesta all'app su Render (APP_ORIGIN in wrangler.jsonc). Senza APP_ORIGIN
// (prima che il servizio esista) risponde la landing, cioè un 404: nessun percorso resta a metà.
async function inoltraAllApp(request, env, url) {
  if (!env.APP_ORIGIN) return env.ASSETS.fetch(request);
  const origine = new URL(env.APP_ORIGIN);
  const intestazioni = new Headers(request.headers);
  intestazioni.delete("Host");
  intestazioni.set("X-Forwarded-Host", url.host);
  const risposta = await fetch(new URL(url.pathname + url.search, origine), {
    method: request.method,
    headers: intestazioni,
    body: request.body,
    redirect: "manual",
  });
  const copia = new Response(risposta.body, risposta);

  // L'app rimanda solo a pagine sue, ma dietro il proxy di Render può scriverle con un indirizzo qualsiasi
  // (http://, host interno, .onrender.com): teniamo percorso, query e ancora, sempre su fairkm.com.
  const location = copia.headers.get("Location");
  if (location) {
    const destinazione = new URL(location, url);
    copia.headers.set("Location", `${url.origin}${destinazione.pathname}${destinazione.search}${destinazione.hash}`);
  }
  // /races/ cambia con cookie e lingua del browser (src/proxy.ts): le cache non devono mescolare le lingue.
  if (url.pathname === `/${CARTELLA_GARE}/`) copia.headers.set("Vary", "Accept-Language, Cookie");
  return copia;
}

function rimanda(destinazione, intestazioni = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: destinazione, "Cache-Control": "no-store", ...intestazioni },
  });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    // Fino al 2026-10-18 l'inglese stava in /en/: i vecchi link portano alla radice.
    if (url.pathname === "/en" || url.pathname.startsWith("/en/")) {
      url.pathname = url.pathname.slice(3) || "/";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/iscrizione") return iscrivi(request, env);
    if (eDellApp(url.pathname)) return inoltraAllApp(request, env, url);
    if (url.pathname !== "/") return env.ASSETS.fetch(request);

    // Scelta dal selettore (/?lang=en): la ricordiamo per un anno.
    const scelta = url.searchParams.get("lang");
    if (LINGUE.includes(scelta)) {
      return rimanda(percorso(scelta), {
        "Set-Cookie": `${COOKIE}=${scelta}; Path=/; Max-Age=${UN_ANNO}; SameSite=Lax; Secure`,
      });
    }

    const lingua = scegliLingua(request.headers.get("Cookie"), request.headers.get("Accept-Language"));
    if (lingua !== PREDEFINITA) return rimanda(percorso(lingua), { Vary: "Accept-Language, Cookie" });

    const pagina = await env.ASSETS.fetch(request);
    const risposta = new Response(pagina.body, pagina);
    risposta.headers.set("Vary", "Accept-Language, Cookie");
    return risposta;
  },
};

export default worker;
