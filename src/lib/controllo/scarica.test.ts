import { describe, expect, it } from "vitest";
import { Robots, scaricaFonte } from "./scarica";

type Risposte = Record<string, { status?: number; body?: string | Uint8Array; headers?: Record<string, string> }>;

function finto(risposte: Risposte) {
  const chiamate: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    chiamate.push({ url: u, init });
    const r = risposte[u];
    if (!r) return new Response("non trovata", { status: 404 });
    return new Response((r.body ?? "") as BodyInit, { status: r.status ?? 200, headers: r.headers });
  }) as typeof fetch;
  return { f, chiamate };
}

const HTML = `<html><body><h1>Trail</h1><p>Quota di iscrizione: 35 €</p><p>Posti rimasti: 12</p></body></html>`;

describe("scaricaFonte", () => {
  it("pagina: righe utili e impronta; si presenta con il suo nome e non segue i rimandi da sola", async () => {
    const { f, chiamate } = finto({ "https://gara.it/regolamento": { body: HTML, headers: { "content-type": "text/html" } } });
    const esito = await scaricaFonte("https://gara.it/regolamento", f, new Robots(f));
    expect(esito).toMatchObject({ stato: "ok", formato: "pagina", righe: ["Quota di iscrizione: 35 €"] });
    const pagina = chiamate.find((c) => c.url === "https://gara.it/regolamento")!;
    expect(new Headers(pagina.init?.headers).get("User-Agent")).toMatch(/^FairKM-controllo/);
    expect(pagina.init?.redirect).toBe("manual");
  });

  it("rimandi sullo stesso sito sì, verso un altro sito no", async () => {
    const { f } = finto({
      "http://gara.it/r": { status: 301, headers: { location: "https://www.gara.it/r" } },
      "https://www.gara.it/r": { body: HTML },
      "https://gara.it/vecchia": { status: 302, headers: { location: "https://parcheggio.com/" } },
    });
    expect((await scaricaFonte("http://gara.it/r", f, new Robots(f))).stato).toBe("ok");
    expect(await scaricaFonte("https://gara.it/vecchia", f, new Robots(f))).toEqual({
      stato: "errore",
      dettaglio: "rimanda a un altro sito: parcheggio.com",
    });
  });

  it("PDF: solo l'impronta dei byte", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 contenuto");
    const { f } = finto({ "https://gara.it/reg.pdf": { body: pdf, headers: { "content-type": "application/pdf" } } });
    const esito = await scaricaFonte("https://gara.it/reg.pdf", f, new Robots(f));
    expect(esito).toMatchObject({ stato: "ok", formato: "pdf" });
    expect("impronta" in esito && esito.impronta).toHaveLength(64);
  });

  it("robots.txt che vieta: non si scarica la pagina", async () => {
    const { f, chiamate } = finto({
      "https://gara.it/robots.txt": { body: "User-agent: *\nDisallow: /" },
      "https://gara.it/r": { body: HTML },
    });
    expect((await scaricaFonte("https://gara.it/r", f, new Robots(f))).stato).toBe("vietata_da_robots");
    expect(chiamate.map((c) => c.url)).toEqual(["https://gara.it/robots.txt"]);
  });

  it("robots.txt irraggiungibile per errore del sito: per prudenza non si scarica", async () => {
    const { f } = finto({ "https://gara.it/robots.txt": { status: 503 }, "https://gara.it/r": { body: HTML } });
    expect((await scaricaFonte("https://gara.it/r", f, new Robots(f))).stato).toBe("non_controllabile");
  });

  it("403 e pagine anti-robot: non controllabile; 404: errore", async () => {
    const { f } = finto({
      "https://a.it/r": { status: 403 },
      "https://b.it/r": { body: "<title>Just a moment...</title><p>Checking your browser</p>" },
    });
    expect((await scaricaFonte("https://a.it/r", f, new Robots(f))).stato).toBe("non_controllabile");
    expect((await scaricaFonte("https://b.it/r", f, new Robots(f))).stato).toBe("non_controllabile");
    expect(await scaricaFonte("https://c.it/r", f, new Robots(f))).toEqual({ stato: "errore", dettaglio: "il sito risponde 404" });
  });

  it("robots.txt si legge una volta per sito", async () => {
    const { f, chiamate } = finto({ "https://gara.it/a": { body: HTML }, "https://gara.it/b": { body: HTML } });
    const robots = new Robots(f);
    await scaricaFonte("https://gara.it/a", f, robots);
    await scaricaFonte("https://gara.it/b", f, robots);
    expect(chiamate.filter((c) => c.url.endsWith("/robots.txt"))).toHaveLength(1);
  });
});
