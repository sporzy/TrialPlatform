// Scelta della lingua per l'app delle gare, con le stesse regole del Worker della landing
// (landing/worker.js e lingue.mjs): l'inglese in /races/, le altre lingue in /it/races/, /fr/races/, ...;
// su /races/ conta il cookie, poi la lingua del browser. Su fairkm.com il Worker inoltra qui solo questi percorsi.
// Le pagine restano statiche: qui si sceglie solo quale servire.

import { NextResponse, type NextRequest } from "next/server";
import { CARTELLA_GARE, COOKIE, LINGUE, PREDEFINITA, percorsoGare, scegliLingua } from "../landing/lingue.mjs";
import { configDaAmbiente, INTESTAZIONE_TOKEN, tokenDaRichiesta, verificaToken } from "./lib/admin/accesso";

const UN_ANNO = 60 * 60 * 24 * 365;
const RADICE_GARE = percorsoGare(PREDEFINITA);

// La risposta di /races/ cambia con cookie e lingua del browser: una cache davanti (Cloudflare) non deve mescolarle.
const VARY = "Accept-Language, Cookie";

function rimanda(request: NextRequest, pathname: string, status: number) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url, status);
}

function riscrivi(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url);
}

// Pagine della redazione (src/app/admin/): fuori dalla scelta della lingua, solo in italiano.
const CARTELLA_ADMIN = "admin";
const PRIVATO = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" };

// Seconda barriera di /admin/ (la prima è Cloudflare Access, la terza il controllo in ogni pagina e azione):
// senza un token di Access valido la risposta è un 404 qualunque, anche chiamando direttamente Render.
async function admin(request: NextRequest) {
  const token = tokenDaRichiesta(request.headers.get(INTESTAZIONE_TOKEN), request.headers.get("cookie"));
  const redattore = await verificaToken(token, configDaAmbiente());
  const risposta = redattore ? NextResponse.next() : new NextResponse("Not found", { status: 404 });
  for (const [nome, valore] of Object.entries(PRIVATO)) risposta.headers.set(nome, valore);
  return risposta;
}

export function proxy(request: NextRequest): NextResponse | Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;
  const [primo, secondo] = pathname.split("/").slice(1);

  if (primo === CARTELLA_ADMIN) return admin(request);

  // L'inglese non ha cartella: i link a /en/... portano alla radice.
  if (primo === PREDEFINITA) {
    return rimanda(request, pathname.slice(PREDEFINITA.length + 1) || "/", 301);
  }

  if (pathname === RADICE_GARE) {
    // Scelta dal selettore (/races/?lang=it): la ricordiamo per un anno.
    const scelta = searchParams.get("lang");
    if (scelta && LINGUE.includes(scelta)) {
      const risposta = rimanda(request, percorsoGare(scelta), 302);
      risposta.headers.set("Cache-Control", "no-store");
      risposta.headers.set("Set-Cookie", `${COOKIE}=${scelta}; Path=/; Max-Age=${UN_ANNO}; SameSite=Lax; Secure`);
      return risposta;
    }

    const lingua = scegliLingua(request.headers.get("Cookie"), request.headers.get("Accept-Language"));
    const risposta =
      lingua === PREDEFINITA
        ? riscrivi(request, `/${PREDEFINITA}${RADICE_GARE}`)
        : rimanda(request, percorsoGare(lingua), 302);
    if (lingua !== PREDEFINITA) risposta.headers.set("Cache-Control", "no-store");
    risposta.headers.set("Vary", VARY);
    return risposta;
  }

  // Senza il Worker davanti (es. l'indirizzo di Render): la home di una lingua porta alle sue gare.
  if (pathname === "/") return rimanda(request, RADICE_GARE, 302);
  if (LINGUE.includes(primo) && !secondo) return rimanda(request, percorsoGare(primo), 302);

  // /it/races/..., /fr/races/...: la lingua è già nel percorso.
  if (LINGUE.includes(primo) && secondo === CARTELLA_GARE) return NextResponse.next();

  // Ogni altro percorso è in inglese (/races/... o pagine che non esistono: 404).
  return riscrivi(request, `/${PREDEFINITA}${pathname}`);
}

export const config = {
  // Fuori i file interni di Next e i file statici (con estensione).
  matcher: ["/((?!_next/|.*\\.[^/]+$).*)"],
};
