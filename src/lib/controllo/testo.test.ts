import { describe, expect, it } from "vitest";
import { confrontaRighe, prezzoPresente, righeUtili, testoDaHtml } from "./testo";

describe("testoDaHtml", () => {
  it("toglie script, stili, commenti e tag; una riga per blocco; decodifica le entità", () => {
    const html = `<html><head><title>x</title><style>p{}</style></head><body>
      <script>var prezzo = "99 €";</script><!-- 12 € -->
      <h2>Quote&nbsp;d&#39;iscrizione</h2><p>Trail 25K: <b>35&nbsp;&euro;</b></p><ul><li>Ultra &amp; 50K: &#8364; 60</li></ul>
    </body></html>`;
    expect(testoDaHtml(html).split("\n")).toEqual(["Quote d'iscrizione", "Trail 25K: 35 €", "Ultra & 50K: € 60"]);
  });
});

describe("righeUtili", () => {
  it("tiene prezzi, iscrizioni, distanze; toglie contatori, cookie e doppioni", () => {
    const testo = [
      "Benvenuti al trail!",
      "Quota di iscrizione: 35 €",
      "Quota di iscrizione: 35 €",
      "Percorso: 25 km, D+ 1500",
      "Posti rimasti: 120",
      "Only 45 places left",
      "Entries: 245",
      "Questo sito usa i cookie per le statistiche",
      "Entry fee £55.00",
    ].join("\n");
    expect(righeUtili(testo)).toEqual(["Quota di iscrizione: 35 €", "Percorso: 25 km, D+ 1500", "Entry fee £55.00"]);
  });
});

describe("confrontaRighe", () => {
  it("righe tolte e aggiunte", () => {
    expect(confrontaRighe(["a 35 €", "b 25 km"], ["a 38 €", "b 25 km"])).toEqual({ tolte: ["a 35 €"], aggiunte: ["a 38 €"] });
    expect(confrontaRighe(["x"], ["x"])).toEqual({ tolte: [], aggiunte: [] });
  });
});

describe("prezzoPresente", () => {
  it("euro: prima o dopo il simbolo, con o senza decimali", () => {
    for (const t of ["Quota 35 €", "Quota €35", "Quota 35,00 €", "Quota € 35.00", "quota 35 EUR", "35 euro"]) {
      expect(prezzoPresente(t, 35, "EUR"), t).toBe(true);
    }
  });

  it("sterline e decimali come 119,90", () => {
    expect(prezzoPresente("Entry fee £55.00", 55, "GBP")).toBe(true);
    expect(prezzoPresente("Iscrizione € 119,90", 119.9, "EUR")).toBe(true);
    expect(prezzoPresente("Iscrizione € 119,9", 119.9, "EUR")).toBe(true);
    expect(prezzoPresente("Quota 1.200 €", 1200, "EUR")).toBe(true);
  });

  it("non confonde un importo con parte di un altro numero o con un'altra valuta", () => {
    expect(prezzoPresente("Quota 135 €", 35, "EUR")).toBe(false);
    expect(prezzoPresente("Quota 35,50 €", 35, "EUR")).toBe(false);
    expect(prezzoPresente("Quota €350", 35, "EUR")).toBe(false);
    expect(prezzoPresente("Fee £35", 35, "EUR")).toBe(false);
    expect(prezzoPresente("25 km, 35 partecipanti", 35, "EUR")).toBe(false);
  });
});
