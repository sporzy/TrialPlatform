import { describe, expect, it } from "vitest";
import { formato } from "./formato";

// Intl usa spazi non separabili: per i confronti li rendiamo spazi normali.
const spazi = (s: string) => s.replace(/\s/g, " ");

describe("formato it-IT", () => {
  const f = formato("it-IT");

  it("valuta locale, mai convertita", () => {
    expect(spazi(f.valuta(320.31, "EUR"))).toBe("320,31 €");
    expect(spazi(f.valuta(189, "GBP"))).toBe("189,00 £");
  });

  it("numeri con separatori italiani", () => {
    expect(f.numero(11500)).toBe("11.500");
    expect(f.numero(9000)).toBe("9.000");
    expect(f.numero(1.7995, 2)).toBe("1,80");
    expect(f.km(14.45)).toBe("14,5");
    expect(f.km(120)).toBe("120");
  });

  it("percentuali con segno", () => {
    expect(f.percentuale(-0.532)).toBe("−53%");
    expect(f.percentuale(0.45)).toBe("+45%");
    expect(f.percentuale(0.004)).toBe("0%");
    expect(f.percentuale(-0.004)).toBe("0%");
  });
});

describe("formato nelle altre lingue", () => {
  it("en-GB: valuta davanti, punto decimale", () => {
    const f = formato("en-GB");
    expect(f.valuta(189, "GBP")).toBe("£189.00");
    expect(f.valuta(320.31, "EUR")).toBe("€320.31");
    expect(f.numero(9000)).toBe("9,000");
    expect(f.km(14.45)).toBe("14.5");
    expect(f.percentuale(-0.532)).toBe("−53%");
  });

  it("fr-FR, de-DE, es-ES: spazio prima del simbolo di percentuale e migliaia separate anche sotto 10.000", () => {
    expect(spazi(formato("fr-FR").percentuale(0.45))).toBe("+45 %");
    expect(spazi(formato("de-DE").percentuale(-0.532))).toBe("−53 %");
    expect(formato("es-ES").numero(9000)).toBe("9.000");
    expect(spazi(formato("fr-FR").numero(9000))).toBe("9 000");
  });

  it("date di verifica col mese abbreviato, senza slittare di un giorno col fuso", () => {
    expect(formato("en-GB").data("2026-10-08")).toBe("8 Oct 2026");
    expect(formato("it-IT").data("2026-10-08")).toBe("8 ott 2026");
    expect(formato("de-DE").data("2026-10-08")).toBe("8. Okt. 2026");
    expect(formato("en-GB").data("2026-01-01")).toBe("1 Jan 2026");
  });
});
