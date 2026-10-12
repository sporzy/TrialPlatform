import { describe, expect, it } from "vitest";
import { formatKm, formatNumero, formatPercentuale, formatValuta } from "./formato";

// Intl usa spazi non separabili: per i confronti li rendiamo spazi normali.
const spazi = (s: string) => s.replace(/\s/g, " ");

describe("formato it-IT", () => {
  it("valuta locale, mai convertita", () => {
    expect(spazi(formatValuta(320.31, "EUR"))).toBe("320,31 €");
    expect(spazi(formatValuta(189, "GBP"))).toBe("189,00 £");
  });

  it("numeri con separatori italiani", () => {
    expect(formatNumero(11500)).toBe("11.500");
    expect(formatNumero(9000)).toBe("9.000");
    expect(formatNumero(1.7995, 2)).toBe("1,80");
    expect(formatKm(14.45)).toBe("14,5");
    expect(formatKm(120)).toBe("120");
  });

  it("percentuali con segno", () => {
    expect(formatPercentuale(-0.532)).toBe("−53%");
    expect(formatPercentuale(0.45)).toBe("+45%");
    expect(formatPercentuale(0.004)).toBe("0%");
    expect(formatPercentuale(-0.004)).toBe("0%");
  });
});
