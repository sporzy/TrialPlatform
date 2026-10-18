import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLONNE_GARE, importaGare, parseCsv, slug } from "./importa-csv";

const GARE_CSV = readFileSync(join(process.cwd(), "data/gare.csv"), "utf8");
const INTESTAZIONE = COLONNE_GARE.join(",");

// Riga minima valida; `over` sostituisce singole colonne.
function riga(over: Partial<Record<(typeof COLONNE_GARE)[number], string>> = {}): string {
  const base: Record<string, string> = {
    evento: "Trail di Prova", distanza: "Lungo", paese: "IT", zona: "", categoria: "piccola",
    riferimento_nazionale: "no", edizione: "2026", km: "40", dplus: "2000", prezzo: "50",
    valuta: "EUR", scaglione: "standard", prezzo_precedente: "", edizione_precedente: "",
    include_iva: "", include_commissioni: "", fonte_url: "", altre_fonti_url: "",
    fonte_storico_url: "", fonte_prezzo_precedente_url: "", fonte_tipo: "", data_verifica: "", note: "",
    ...over,
  };
  return COLONNE_GARE.map((c) => base[c]).join(",");
}

describe("parseCsv", () => {
  it("gestisce virgolette, virgole e virgolette doppie dentro i campi", () => {
    expect(parseCsv('a,"b, c","d ""e"""\n')).toEqual([["a", "b, c", 'd "e"']]);
  });

  it("gestisce CRLF, a capo dentro le virgolette e campi vuoti in fondo", () => {
    expect(parseCsv('a,b,\r\n"x\ny",z,\r\n')).toEqual([
      ["a", "b", ""],
      ["x\ny", "z", ""],
    ]);
  });

  it("accetta l'ultima riga senza a capo finale", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("rifiuta virgolette non chiuse", () => {
    expect(() => parseCsv('a,"b\n')).toThrow(/virgolette/);
  });
});

describe("slug", () => {
  it("toglie accenti e apostrofi", () => {
    expect(slug("IT Tor des Géants")).toBe("it-tor-des-geants");
    expect(slug("UK Devil o’ the Highlands")).toBe("uk-devil-o-the-highlands");
  });
});

describe("importaGare con data/gare.csv", () => {
  const dati = importaGare(GARE_CSV);

  it("102 distanze, 75 gare, 122 prezzi (102 attuali + 20 precedenti)", () => {
    expect(dati.distances).toHaveLength(102);
    expect(dati.races).toHaveLength(75);
    expect(dati.prices).toHaveLength(122);
  });

  it("50 distanze in Italia e 52 nel Regno Unito, ognuna nella sua valuta", () => {
    const paeseDi = new Map(dati.races.map((r) => [r.id, r.paese]));
    const conta = (p: string) => dati.distances.filter((d) => paeseDi.get(d.raceId) === p).length;
    expect(conta("IT")).toBe(50);
    expect(conta("UK")).toBe(52);
    const valutaPerPaese = new Set(
      dati.prices.map((p) => `${paeseDi.get(p.distanceId.split("--")[0])}:${p.valuta}`),
    );
    expect([...valutaPerPaese].sort()).toEqual(["IT:EUR", "UK:GBP"]);
  });

  it("6 riferimenti nazionali: Lavaredo 20K/50K/80K/120K e UTS 50K/100M", () => {
    expect(dati.distances.filter((d) => d.riferimentoNazionale).map((d) => d.id)).toEqual([
      "it-lavaredo-ultra-trail--120k",
      "it-lavaredo-ultra-trail--80k",
      "it-lavaredo-ultra-trail--50k",
      "it-lavaredo-ultra-trail--20k",
      "uk-ultra-trail-snowdonia--uts-50k",
      "uk-ultra-trail-snowdonia--uts-100m",
    ]);
  });

  it("id unici e ogni prezzo punta a una distanza esistente", () => {
    const ids = new Set(dati.distances.map((d) => d.id));
    expect(ids.size).toBe(dati.distances.length);
    expect(new Set(dati.races.map((r) => r.id)).size).toBe(dati.races.length);
    expect(dati.prices.every((p) => ids.has(p.distanceId))).toBe(true);
  });

  it("Lavaredo 50K: prezzi 2026 e 2027 come storico, stessa base e scaglione", () => {
    const prezzi = dati.prices.filter((p) => p.distanceId === "it-lavaredo-ultra-trail--50k");
    expect(prezzi.map((p) => [p.edizione, p.prezzo, p.scaglione, p.valuta])).toEqual([
      [2027, 173.84, "standard", "EUR"],
      [2026, 119.9, "standard", "EUR"],
    ]);
  });

  it("Lavaredo 120K dichiara IVA e commissioni incluse; le gare dell'Excel restano non verificate", () => {
    const lav = dati.prices.find((p) => p.distanceId === "it-lavaredo-ultra-trail--120k")!;
    expect([lav.includeIva, lav.includeCommissioni]).toEqual([true, true]);
    const drago = dati.prices.find((p) => p.distanceId === "it-trail-del-drago--trail-del-drago-10k")!;
    expect([drago.includeIva, drago.includeCommissioni]).toEqual([null, null]);
  });

  it("le righe dell'Excel portano fonte, data di verifica e zona", () => {
    const drago = dati.prices.find((p) => p.distanceId === "it-trail-del-drago--trail-del-drago-10k")!;
    expect(drago.fonteUrl).toMatch(/^https:\/\//);
    expect(drago.dataRilevazione).toBe("2026-10-08");
    expect(dati.races.find((r) => r.id === "it-trail-del-drago")?.regione).toContain("Trentino");
  });
});

describe("importaGare: errori", () => {
  const csv = (...righe: string[]) => [INTESTAZIONE, ...righe].join("\n") + "\n";

  it("rifiuta un'intestazione diversa", () => {
    expect(() => importaGare("evento,distanza\nA,B\n")).toThrow(/Intestazione/);
  });

  it("rifiuta scaglione e categoria non ammessi", () => {
    expect(() => importaGare(csv(riga({ scaglione: "saver" })))).toThrow(/scaglione/);
    expect(() => importaGare(csv(riga({ categoria: "ultra" })))).toThrow(/categoria/);
  });

  it("rifiuta numeri non validi", () => {
    expect(() => importaGare(csv(riga({ km: "circa 40" })))).toThrow(/km/);
    expect(() => importaGare(csv(riga({ prezzo: "" })))).toThrow(/prezzo/);
  });

  it("rifiuta un prezzo precedente senza edizione", () => {
    expect(() => importaGare(csv(riga({ prezzo_precedente: "45" })))).toThrow(/insieme/);
  });

  it("rifiuta distanze della stessa gara con categorie diverse", () => {
    expect(() =>
      importaGare(csv(riga(), riga({ distanza: "Corto", categoria: "fell_race" }))),
    ).toThrow(/categoria diversa/);
  });

  it("rifiuta distanze duplicate", () => {
    expect(() => importaGare(csv(riga(), riga()))).toThrow(/duplicata/);
  });
});
