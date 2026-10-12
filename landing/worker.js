// Davanti alle pagine statiche: www → dominio principale e scelta della lingua su "/".
import { COOKIE, LINGUE, PREDEFINITA, percorso, scegliLingua } from "./lingue.mjs";

const UN_ANNO = 60 * 60 * 24 * 365;

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
