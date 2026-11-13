import { describe, expect, it } from "vitest";
import { differenze, erroriModulo, leggiModulo, prezzoVuoto, type ModuloDistanza } from "./modifiche";

const OGGI = "2026-11-13";

function modulo(): ModuloDistanza {
  return {
    gara: { nome: "Trail di Prova", regione: "Lombardia", categoria: "piccola", organizzatore: "", sito: "", qualifica_utmb: "no", fonte_storico_url: "" },
    distanza: { nome: "Lungo", km: "42", dplus: "2500", riferimento_nazionale: "no", note: "", altre_fonti_url: "" },
    prezzi: [{
      id: 1, edizione: "2026", scaglione: "standard", ordine: "1", prezzo: "55", valuta: "EUR",
      fonte_url: "https://example.org/r", fonte_tipo: "primaria ufficiale", data_rilevazione: "2026-10-08",
      include_iva: "", include_commissioni: "", elimina: false,
    }],
  };
}

describe("leggiModulo", () => {
  it("legge gara, distanza, prezzi esistenti, il prezzo nuovo e le eliminazioni", () => {
    const m = leggiModulo(new Map([
      ["gara.nome", " Trail "], ["distanza.km", "42"],
      ["prezzo.7.prezzo", "55"], ["prezzo.7.valuta", "eur"], ["prezzo.7.elimina", "on"],
      ["prezzo.9.prezzo", "60"],
      ["prezzo.nuovo.prezzo", "70"], ["prezzo.nuovo.edizione", "2027"],
    ]));
    expect(m.gara.nome).toBe("Trail");
    expect(m.prezzi.map((p) => [p.id, p.prezzo, p.elimina, p.ordine])).toEqual([
      [7, "55", true, "1"], [9, "60", false, "1"], [null, "70", false, "1"],
    ]);
    expect(m.prezzi[0].valuta).toBe("EUR");
  });

  it("un prezzo nuovo senza importo non conta", () => {
    expect(leggiModulo(new Map([["prezzo.nuovo.edizione", "2027"]])).prezzi).toEqual([]);
  });
});

describe("erroriModulo", () => {
  it("una scheda corretta si salva", () => {
    expect(erroriModulo(modulo(), OGGI)).toEqual([]);
  });

  it("stesse regole dell'approvazione sui prezzi: fonte primaria https, data, valuta", () => {
    const m = modulo();
    m.prezzi[0] = { ...m.prezzi[0], fonte_tipo: "blog", fonte_url: "http://x", data_rilevazione: "2026-12-01", valuta: "E" };
    const e = erroriModulo(m, OGGI).join(" ");
    for (const atteso of ["fonti primarie", "https", "futuro", "valuta"]) expect(e).toContain(atteso);
  });

  it("deve restare almeno un prezzo 2026 o successivo", () => {
    const m = modulo();
    m.prezzi[0].elimina = true;
    expect(erroriModulo(m, OGGI).join()).toMatch(/almeno un prezzo/);
    m.prezzi.push({ ...prezzoVuoto("EUR"), edizione: "2025", prezzo: "50", fonte_url: "https://x.org", fonte_tipo: "primaria", data_rilevazione: OGGI });
    expect(erroriModulo(m, OGGI).join()).toMatch(/almeno un prezzo/);
  });

  it("niente due prezzi con la stessa edizione e scaglione; km, D+ e indirizzi validi", () => {
    const m = modulo();
    m.prezzi.push({ ...m.prezzi[0], id: null });
    m.distanza = { ...m.distanza, km: "0", dplus: "12.5", altre_fonti_url: "https://ok.org\nftp://no" };
    const e = erroriModulo(m, OGGI).join(" ");
    for (const atteso of ["stessa edizione", "km", "D+", "ftp://no"]) expect(e).toContain(atteso);
  });
});

describe("differenze", () => {
  it("elenca ciò che è cambiato, aggiunto ed eliminato", () => {
    const prima = modulo();
    const dopo = modulo();
    dopo.gara.regione = "Piemonte";
    dopo.prezzi[0].prezzo = "60";
    dopo.prezzi.push({ ...prezzoVuoto("EUR"), id: 2, edizione: "2027", prezzo: "65" });
    expect(differenze(prima, dopo)).toEqual([
      "gara.regione: Lombardia → Piemonte",
      "prezzo 2026 standard: prezzo 55 → 60",
      "prezzo 2027 standard: aggiunto (65 EUR)",
    ]);
    expect(differenze(dopo, prima)).toContain("prezzo 2027 standard: eliminato");
    expect(differenze(prima, modulo())).toEqual([]);
  });
});
