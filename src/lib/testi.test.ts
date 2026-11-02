import { describe, expect, it } from "vitest";
import { LINGUE, RIFERIMENTO } from "../../landing/lingue.mjs";
import { controllaTesti, LOCALE, TESTI, traduttore } from "./testi";

describe("testi dell'interfaccia", () => {
  it("stesse lingue della landing, con l'inglese come riferimento", () => {
    expect(Object.keys(TESTI).sort()).toEqual([...LINGUE].sort());
    expect(Object.keys(LOCALE).sort()).toEqual([...LINGUE].sort());
    expect(RIFERIMENTO).toBe("en");
  });

  it("ogni lingua ha tutte le chiavi dell'inglese, non vuote e con gli stessi segnaposto", () => {
    expect(controllaTesti(TESTI, RIFERIMENTO)).toEqual([]);
  });

  it("segnala chiavi mancanti, in più, vuote o con segnaposti diversi", () => {
    const errori = controllaTesti(
      {
        en: { a: "A {{n}}", b: "B", c: "C" },
        fr: { a: "A", b: " ", d: "D" },
      },
      "en",
    );
    expect(errori).toEqual([
      'fr.json: manca "c"',
      'fr.json: "a" ha segnaposti diversi da en.json',
      'fr.json: "b" è vuota',
      'fr.json: "d" non esiste in en.json',
    ]);
  });

  it("ogni paese dei dati ha un nome in ogni lingua", () => {
    for (const testi of Object.values(TESTI)) {
      expect(testi["paese.IT"]).toBeTruthy();
      expect(testi["paese.UK"]).toBeTruthy();
    }
  });
});

describe("traduttore", () => {
  it("sostituisce i segnaposto", () => {
    expect(traduttore("it").t("indice.vs", { riferimento: "Lavaredo 50K" })).toBe("vs Lavaredo 50K");
  });

  it("singolare e plurale secondo la lingua", () => {
    const en = traduttore("en");
    expect(en.tNumero("sezione.conteggio", 1, "1")).toBe("1 distance");
    expect(en.tNumero("sezione.conteggio", 52, "52")).toBe("52 distances");
    // In francese 0 è singolare.
    expect(traduttore("fr").tNumero("sezione.conteggio", 0, "0")).toBe("0 distance");
  });
});
