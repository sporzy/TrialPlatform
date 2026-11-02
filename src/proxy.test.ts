import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

// Come in produzione: Next passa al proxy la sua configurazione (trailingSlash in next.config.ts).
const visita = (indirizzo: string, intestazioni: Record<string, string> = {}) =>
  proxy(new NextRequest(`https://fairkm.com${indirizzo}`, { headers: intestazioni, nextConfig: { trailingSlash: true } }));

// Percorso interno servito da una riscrittura (null se non è una riscrittura).
const riscritto = (r: Response) => {
  const url = r.headers.get("x-middleware-rewrite");
  return url ? new URL(url).pathname : null;
};

describe("proxy: scelta della lingua come nel Worker della landing", () => {
  it("inglese in /races/, senza rimandi", () => {
    const casi: Record<string, string>[] = [{}, { "Accept-Language": "en-GB" }, { "Accept-Language": "ja-JP" }];
    for (const intestazioni of casi) {
      const r = visita("/races/", intestazioni);
      expect(r.status).toBe(200);
      expect(riscritto(r)).toBe("/en/races/");
      expect(r.headers.get("Vary")).toBe("Accept-Language, Cookie");
    }
  });

  it("le altre lingue del browser rimandate alle gare nella loro lingua", () => {
    const r = visita("/races/", { "Accept-Language": "it-IT,it;q=0.9" });
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://fairkm.com/it/races/");
    expect(r.headers.get("Vary")).toBe("Accept-Language, Cookie");
  });

  it("il cookie della lingua vale più del browser", () => {
    expect(riscritto(visita("/races/", { Cookie: "lang=en", "Accept-Language": "de-DE" }))).toBe("/en/races/");
    expect(visita("/races/", { Cookie: "lang=es", "Accept-Language": "en" }).headers.get("Location")).toBe(
      "https://fairkm.com/es/races/",
    );
  });

  it("il selettore (/races/?lang=xx) salva la scelta e porta alle gare in quella lingua", () => {
    const r = visita("/races/?lang=fr", { "Accept-Language": "it-IT" });
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://fairkm.com/fr/races/");
    expect(r.headers.get("Set-Cookie")).toMatch(/^lang=fr; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
    expect(visita("/races/?lang=en").headers.get("Location")).toBe("https://fairkm.com/races/");
    // Lingua sconosciuta: si ignora.
    expect(riscritto(visita("/races/?lang=xx"))).toBe("/en/races/");
  });

  it("i link a /en/ portano alla versione senza cartella", () => {
    for (const [vecchio, nuovo] of [
      ["/en/races/", "https://fairkm.com/races/"],
      ["/en/", "https://fairkm.com/"],
      ["/en", "https://fairkm.com/"],
    ]) {
      const r = visita(vecchio);
      expect(r.status, vecchio).toBe(301);
      expect(r.headers.get("Location"), vecchio).toBe(nuovo);
    }
  });

  it("le gare nelle altre lingue passano così come sono, il resto è inglese", () => {
    expect(riscritto(visita("/it/races/"))).toBeNull();
    expect(visita("/it/races/").headers.get("x-middleware-next")).toBe("1");
    expect(riscritto(visita("/races/gara/x/"))).toBe("/en/races/gara/x/");
    expect(riscritto(visita("/it/altro/"))).toBe("/en/it/altro/");
  });

  it("senza il Worker davanti, la home di una lingua porta alle sue gare", () => {
    expect(visita("/").headers.get("Location")).toBe("https://fairkm.com/races/");
    expect(visita("/de/").headers.get("Location")).toBe("https://fairkm.com/de/races/");
  });

  it("non tocca i file di Next né quelli statici", () => {
    const [schema] = config.matcher;
    const passa = (p: string) => new RegExp(`^${schema}$`).test(p);
    expect(passa("/races/")).toBe(true);
    expect(passa("/it/races/")).toBe(true);
    expect(passa("/_next/static/x.js")).toBe(false);
    expect(passa("/favicon.ico")).toBe(false);
  });
});
