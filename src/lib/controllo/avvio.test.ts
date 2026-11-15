import { describe, expect, it } from "vitest";
import { modalita, segretoValido } from "./avvio";

const SEGRETO = "a".repeat(64);

describe("segretoValido", () => {
  it("solo con il segreto giusto, come Bearer", () => {
    expect(segretoValido(`Bearer ${SEGRETO}`, SEGRETO)).toBe(true);
    expect(segretoValido(`Bearer ${"b".repeat(64)}`, SEGRETO)).toBe(false);
    expect(segretoValido(SEGRETO, SEGRETO)).toBe(false);
    expect(segretoValido(null, SEGRETO)).toBe(false);
  });

  it("senza segreto configurato (o troppo corto) nessuno avvia nulla", () => {
    expect(segretoValido("Bearer ", undefined)).toBe(false);
    expect(segretoValido("Bearer corto", "corto")).toBe(false);
  });
});

describe("modalita", () => {
  it("prova finché non si scrive esplicitamente attivo", () => {
    expect(modalita({})).toBe("prova");
    expect(modalita({ CONTROLLO_MODALITA: "si" })).toBe("prova");
    expect(modalita({ CONTROLLO_MODALITA: "attivo" })).toBe("attivo");
  });
});
