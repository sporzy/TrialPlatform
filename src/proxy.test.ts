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
  it("inglese alla radice, senza rimandi", () => {
    for (const intestazioni of [{}, { "Accept-Language": "en-GB" }, { "Accept-Language": "ja-JP" }] as Record<string, string>[]) {
      const r = visita("/", intestazioni);
      expect(r.status).toBe(200);
      expect(riscritto(r)).toBe("/en/");
      expect(r.headers.get("Vary")).toBe("Accept-Language, Cookie");
    }
  });

  it("le altre lingue del browser rimandate alla loro cartella", () => {
    const r = visita("/", { "Accept-Language": "it-IT,it;q=0.9" });
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://fairkm.com/it/");
    expect(r.headers.get("Vary")).toBe("Accept-Language, Cookie");
  });

  it("il cookie della lingua vale più del browser", () => {
    expect(riscritto(visita("/", { Cookie: "lang=en", "Accept-Language": "de-DE" }))).toBe("/en/");
    expect(visita("/", { Cookie: "lang=es", "Accept-Language": "en" }).headers.get("Location")).toBe(
      "https://fairkm.com/es/",
    );
  });

  it("il selettore (/?lang=xx) salva la scelta e porta alla pagina della lingua", () => {
    const r = visita("/?lang=fr", { "Accept-Language": "it-IT" });
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://fairkm.com/fr/");
    expect(r.headers.get("Set-Cookie")).toMatch(/^lang=fr; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
    expect(visita("/?lang=en").headers.get("Location")).toBe("https://fairkm.com/");
    // Lingua sconosciuta: si ignora.
    expect(riscritto(visita("/?lang=xx"))).toBe("/en/");
  });

  it("i link a /en/ portano alla radice", () => {
    for (const [vecchio, nuovo] of [
      ["/en/", "https://fairkm.com/"],
      ["/en", "https://fairkm.com/"],
      ["/en/gara/x/", "https://fairkm.com/gara/x/"],
    ]) {
      const r = visita(vecchio);
      expect(r.status, vecchio).toBe(301);
      expect(r.headers.get("Location"), vecchio).toBe(nuovo);
    }
  });

  it("le cartelle delle altre lingue passano così come sono, il resto è inglese", () => {
    expect(riscritto(visita("/it/"))).toBeNull();
    expect(visita("/it/").headers.get("x-middleware-next")).toBe("1");
    expect(riscritto(visita("/gara/x/"))).toBe("/en/gara/x/");
    expect(riscritto(visita("/entra/"))).toBe("/en/entra/");
  });

  it("non tocca i file di Next né quelli statici", () => {
    const [schema] = config.matcher;
    const passa = (p: string) => new RegExp(`^${schema}$`).test(p);
    expect(passa("/")).toBe(true);
    expect(passa("/it/")).toBe(true);
    expect(passa("/_next/static/x.js")).toBe(false);
    expect(passa("/favicon.ico")).toBe(false);
  });
});
