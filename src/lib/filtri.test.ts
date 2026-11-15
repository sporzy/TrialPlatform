import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costruisciElenco } from "./elenco";
import { FILTRI_VUOTI, filtraElenco, leggiFiltri, lunghezzaDi, normalizza, parametriFiltri, type Filtri } from "./filtri";
import { importaGare } from "./importa-csv";

const sezioni = costruisciElenco(importaGare(readFileSync(join(process.cwd(), "test/gare-esempio.csv"), "utf8")));
const filtra = (f: Partial<Filtri>) => filtraElenco(sezioni, { ...FILTRI_VUOTI, ...f });
const righe = (r: ReturnType<typeof filtra>) => r.sezioni.flatMap((s) => s.gare.flatMap((g) => g.righe));

describe("leggiFiltri e parametriFiltri", () => {
  it("legge valori singoli e multipli; ignora i valori sconosciuti", () => {
    const f = leggiFiltri(
      { paese: "UK", lunghezza: ["media", "xxl"], fascia: ["giusto", "gratis"], q: "  Città ", ordine: "boh" },
      ["IT", "UK"],
    );
    expect(f).toEqual({ paese: "UK", lunghezze: ["media"], fasce: ["giusto"], q: "Città", ordine: "costo" });
    expect(leggiFiltri({ paese: "FR" }, ["IT", "UK"]).paese).toBeNull();
  });

  it("dai filtri all'indirizzo e ritorno; quelli vuoti e l'ordine predefinito non compaiono", () => {
    const f: Filtri = { paese: "IT", lunghezze: ["corta", "lunga"], fasce: ["giusto"], q: "trail", ordine: "km" };
    const p = parametriFiltri(f);
    expect(p.toString()).toBe("paese=IT&lunghezza=corta&lunghezza=lunga&fascia=giusto&q=trail&ordine=km");
    expect(leggiFiltri(Object.fromEntries([...p.keys()].map((k) => [k, p.getAll(k)])), ["IT", "UK"])).toEqual(f);
    expect(parametriFiltri(FILTRI_VUOTI).toString()).toBe("");
  });
});

describe("lunghezzaDi e normalizza", () => {
  it("sotto 30 corta, da 30 a 80 compresi media, oltre 80 lunga (km reali)", () => {
    expect([29.99, 30, 80, 80.01].map(lunghezzaDi)).toEqual(["corta", "media", "media", "lunga"]);
  });

  it("ignora maiuscole e accenti", () => {
    expect(normalizza("Città GÉANTS")).toBe("citta geants");
  });
});

describe("filtraElenco", () => {
  it("senza filtri: tutto, per paese, con le distanze raggruppate per gara", () => {
    const r = filtra({});
    expect(r.sezioni.map((s) => s.paese)).toEqual(["IT", "UK"]);
    expect([r.distanze, r.gare]).toEqual([102, 75]);
    const monviso = r.sezioni[0].gare.find((g) => g.gara === "100 Miglia Monviso")!;
    expect(monviso.righe).toHaveLength(2);
    expect(monviso.nascoste).toBe(0);
  });

  it("paese: solo la sua sezione, mai una sezione mista", () => {
    const r = filtra({ paese: "UK" });
    expect(r.sezioni.map((s) => s.paese)).toEqual(["UK"]);
    expect(r.distanze).toBe(52);
  });

  it("fascia: solo le distanze di quella fascia; le altre della stessa gara contano come nascoste", () => {
    const r = filtra({ fasce: ["giusto"] });
    expect(righe(r).every((x) => x.fascia === "giusto")).toBe(true);
    expect(righe(r).length).toBe(r.conteggi.fascia.giusto);
    const nascoste = r.sezioni.flatMap((s) => s.gare).filter((g) => g.nascoste > 0);
    expect(nascoste.length).toBeGreaterThan(0);
  });

  it("lunghezza: più fasce insieme", () => {
    const r = filtra({ lunghezze: ["corta", "lunga"] });
    expect(righe(r).every((x) => x.km < 30 || x.km > 80)).toBe(true);
    expect(r.distanze).toBe(r.conteggi.lunghezza.corta + r.conteggi.lunghezza.lunga);
  });

  it("ricerca su gara, distanza e zona, senza accenti, tutte le parole", () => {
    expect(filtra({ q: "citta di pietra" }).sezioni[0].gare.map((g) => g.gara)).toEqual(["Gubbio Trail Città di Pietra"]);
    expect(filtra({ q: "umbria gubbio" }).gare).toBe(1);
    expect(filtra({ q: "monviso m50k" }).distanze).toBe(1);
    expect(filtra({ q: "nessuna gara si chiama così" }).sezioni).toEqual([]);
  });

  it("ordine per costo: dentro ogni paese, per il miglior costo della gara; senza prezzo standard in fondo", () => {
    for (const s of filtra({}).sezioni) {
      const chiavi = s.gare.map((g) => g.righe[0].costoKmSforzo ?? Infinity);
      expect(chiavi).toEqual([...chiavi].sort((a, b) => a - b));
    }
  });

  it("ordine per km: prima la gara con la distanza più lunga, e dentro la scheda dalla più lunga", () => {
    const it = filtra({ ordine: "km" }).sezioni[0];
    const massimi = it.gare.map((g) => g.righe[0].km);
    expect(massimi).toEqual([...massimi].sort((a, b) => b - a));
    const monviso = it.gare.find((g) => g.gara === "100 Miglia Monviso")!;
    expect(monviso.righe.map((x) => x.km)).toEqual([160, 50]);
  });

  it("ordine per nome: alfabetico", () => {
    const nomi = filtra({ ordine: "nome" }).sezioni[0].gare.map((g) => g.gara);
    expect(nomi).toEqual([...nomi].sort((a, b) => a.localeCompare(b, "it")));
  });

  it("i conteggi delle opzioni sono sul totale, a prescindere dai filtri scelti", () => {
    const a = filtra({}).conteggi;
    expect(filtra({ paese: "UK", fasce: ["giusto"] }).conteggi).toEqual(a);
    expect(a.lunghezza.corta + a.lunghezza.media + a.lunghezza.lunga).toBe(102);
    expect(a.fascia.categoria_a_parte).toBe(0);
  });
});
