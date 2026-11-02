// Scelta della lingua, con le stesse regole del Worker della landing (landing/worker.js e lingue.mjs):
// l'inglese alla radice, le altre lingue in /it/, /fr/, ...; su "/" conta il cookie, poi la lingua del browser.
// Le pagine restano statiche: qui si sceglie solo quale servire.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, LINGUE, PREDEFINITA, percorso, scegliLingua } from "../landing/lingue.mjs";

const UN_ANNO = 60 * 60 * 24 * 365;

// La risposta di "/" cambia con cookie e lingua del browser: una cache davanti (Cloudflare) non deve mescolarle.
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

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // L'inglese non ha cartella: i link a /en/... portano alla radice.
  if (pathname === `/${PREDEFINITA}` || pathname.startsWith(`/${PREDEFINITA}/`)) {
    return rimanda(request, pathname.slice(PREDEFINITA.length + 1) || "/", 301);
  }

  if (pathname === "/") {
    // Scelta dal selettore (/?lang=it): la ricordiamo per un anno.
    const scelta = searchParams.get("lang");
    if (scelta && LINGUE.includes(scelta)) {
      const risposta = rimanda(request, percorso(scelta), 302);
      risposta.headers.set("Cache-Control", "no-store");
      risposta.headers.set("Set-Cookie", `${COOKIE}=${scelta}; Path=/; Max-Age=${UN_ANNO}; SameSite=Lax; Secure`);
      return risposta;
    }

    const lingua = scegliLingua(request.headers.get("Cookie"), request.headers.get("Accept-Language"));
    const risposta =
      lingua === PREDEFINITA ? riscrivi(request, `/${PREDEFINITA}/`) : rimanda(request, percorso(lingua), 302);
    if (lingua !== PREDEFINITA) risposta.headers.set("Cache-Control", "no-store");
    risposta.headers.set("Vary", VARY);
    return risposta;
  }

  // /it/..., /fr/...: la lingua è già nel percorso.
  const primo = pathname.split("/")[1];
  if (LINGUE.includes(primo)) return NextResponse.next();

  // Ogni altro percorso è in inglese.
  return riscrivi(request, `/${PREDEFINITA}${pathname}`);
}

export const config = {
  // Fuori i file interni di Next e i file statici (con estensione).
  matcher: ["/((?!_next/|.*\\.[^/]+$).*)"],
};
