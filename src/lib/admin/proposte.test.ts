import { describe, expect, it } from "vitest";
import type { RigaGare } from "../importa-csv";
import { datiDaPubblicare, erroriPubblicazione, normalizzaRiga, oggiInItalia } from "./proposte";

const OGGI = "2026-11-13";

function riga(over: Partial<RigaGare> = {}): RigaGare {
  return normalizzaRiga({
    evento: "Trail di Prova", distanza: "Lungo", paese: "IT", zona: "Bergamo (BG), Lombardia", categoria: "piccola",
    riferimento_nazionale: "no", edizione: "2026", km: "42", dplus: "2500", prezzo: "55", valuta: "EUR",
    scaglione: "standard", fonte_url: "https://example.org/regolamento", fonte_tipo: "primaria ufficiale",
    data_verifica: "2026-11-10", ...over,
  });
}

describe("normalizzaRiga", () => {
  it("tiene solo le colonne note, toglie gli spazi, arrotonda km e D+", () => {
    const r = normalizzaRiga({ evento: "  Gara ", km: "80.46720000000001", dplus: "2609.4", paese: "it", valuta: "eur", altro: "x" });
    expect(r.evento).toBe("Gara");
    expect(r.km).toBe("80.47");
    expect(r.dplus).toBe("2609");
    expect([r.paese, r.valuta]).toEqual(["IT", "EUR"]);
    expect("altro" in r).toBe(false);
    expect(r.note).toBe("");
  });

  it("accetta la virgola decimale e lascia com'è un valore non numerico", () => {
    expect(normalizzaRiga({ km: "21,5" }).km).toBe("21.5");
    expect(normalizzaRiga({ km: "circa 40" }).km).toBe("circa 40");
  });
});

describe("erroriPubblicazione", () => {
  it("una riga completa, primaria e 2026 si può pubblicare", () => {
    expect(erroriPubblicazione(riga(), OGGI)).toEqual([]);
  });

  it("solo fonti primarie", () => {
    expect(erroriPubblicazione(riga({ fonte_tipo: "secondaria" }), OGGI).join()).toMatch(/fonti primarie/);
    expect(erroriPubblicazione(riga({ fonte_tipo: "" }), OGGI).join()).toMatch(/Manca fonte_tipo/);
  });

  it("solo prezzi dell'edizione 2026 o successive", () => {
    expect(erroriPubblicazione(riga({ edizione: "2025" }), OGGI).join()).toMatch(/2026 o successive/);
    expect(erroriPubblicazione(riga({ edizione: "2027" }), OGGI)).toEqual([]);
  });

  it("fonte, data di verifica e dati obbligatori", () => {
    const errori = erroriPubblicazione(riga({ fonte_url: "", data_verifica: "", prezzo: "", km: "" }), OGGI).join(" ");
    for (const c of ["fonte_url", "data_verifica", "prezzo", "km"]) expect(errori).toContain(`Manca ${c}`);
  });

  it("indirizzi solo https", () => {
    expect(erroriPubblicazione(riga({ fonte_url: "http://example.org" }), OGGI).join()).toMatch(/fonte_url/);
    expect(erroriPubblicazione(riga({ fonte_storico_url: "non un url" }), OGGI).join()).toMatch(/fonte_storico_url/);
  });

  it("solo paesi che l'elenco sa mostrare", () => {
    expect(erroriPubblicazione(riga({ paese: "FR" }), OGGI).join()).toMatch(/non ancora gestito/);
    expect(erroriPubblicazione(riga({ paese: "UK", valuta: "GBP" }), OGGI)).toEqual([]);
  });

  it("valori ammessi per categoria, scaglione, valuta, sì/no", () => {
    expect(erroriPubblicazione(riga({ categoria: "ultra" }), OGGI).join()).toMatch(/Categoria/);
    expect(erroriPubblicazione(riga({ scaglione: "saver" }), OGGI).join()).toMatch(/Scaglione/);
    expect(erroriPubblicazione(riga({ valuta: "EURO" }), OGGI).join()).toMatch(/Valuta/);
    expect(erroriPubblicazione(riga({ include_iva: "forse" }), OGGI).join()).toMatch(/include_iva/);
  });

  it("prezzo precedente: con la sua edizione, e prima di quella attuale", () => {
    expect(erroriPubblicazione(riga({ prezzo_precedente: "50" }), OGGI).join()).toMatch(/insieme/);
    expect(erroriPubblicazione(riga({ prezzo_precedente: "50", edizione_precedente: "2026" }), OGGI).join()).toMatch(/prima/);
    expect(erroriPubblicazione(riga({ prezzo_precedente: "50", edizione_precedente: "2025" }), OGGI)).toEqual([]);
  });

  it("data di verifica valida e non nel futuro", () => {
    expect(erroriPubblicazione(riga({ data_verifica: "13/11/2026" }), OGGI).join()).toMatch(/AAAA-MM-GG/);
    expect(erroriPubblicazione(riga({ data_verifica: "2026-02-30" }), OGGI).join()).toMatch(/AAAA-MM-GG/);
    expect(erroriPubblicazione(riga({ data_verifica: "2026-11-14" }), OGGI).join()).toMatch(/futuro/);
  });

  it("numeri: km positivi, D+ in metri", () => {
    expect(erroriPubblicazione(riga({ km: "0" }), OGGI).join()).toMatch(/km/);
    expect(erroriPubblicazione(riga({ dplus: "tanto" }), OGGI).join()).toMatch(/dplus/);
  });
});

describe("datiDaPubblicare", () => {
  it("con gli stessi id dell'import: gara da paese ed evento, distanza dal nome", () => {
    const { dati } = datiDaPubblicare(riga({ prezzo_precedente: "50", edizione_precedente: "2025" }), OGGI);
    expect(dati?.race.id).toBe("it-trail-di-prova");
    expect(dati?.distance.id).toBe("it-trail-di-prova--lungo");
    expect(dati?.prices.map((p) => [p.edizione, p.prezzo, p.fonteTipo])).toEqual([
      [2026, 55, "primaria ufficiale"],
      [2025, 50, "primaria ufficiale"],
    ]);
  });

  it("niente dati se c'è un errore", () => {
    expect(datiDaPubblicare(riga({ edizione: "2024" }), OGGI).dati).toBeNull();
  });
});

describe("oggiInItalia", () => {
  it("usa l'ora italiana", () => {
    expect(oggiInItalia(new Date("2026-11-13T23:30:00Z"))).toBe("2026-11-14");
    expect(oggiInItalia(new Date("2026-11-13T12:00:00Z"))).toBe("2026-11-13");
  });
});
