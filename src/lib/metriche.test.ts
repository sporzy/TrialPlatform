import { describe, expect, it } from "vitest";
import {
  aumentoYoy,
  badgeAumento,
  costoKmSforzo,
  fasciaPrezzo,
  indiceBenchmark,
  kmSforzo,
  scegliRiferimento,
  type PrezzoConfrontabile,
} from "./metriche";

// Distanza del CSV con le metriche calcolate, per i test sui riferimenti.
function distanza(nome: string, paese: string, valuta: string, km: number, dplus: number, prezzo: number) {
  const kmSf = kmSforzo(km, dplus);
  return { nome, paese, valuta, kmSforzo: kmSf, costoKmSforzo: costoKmSforzo(prezzo, kmSf) };
}

const RIFERIMENTI = [
  distanza("Lavaredo 50K", "IT", "EUR", 50, 2600, 173.84),
  distanza("Lavaredo 80K", "IT", "EUR", 80, 4600, 224.49),
  distanza("Lavaredo 120K", "IT", "EUR", 120, 5800, 320.31),
  distanza("UTS 50K", "UK", "GBP", 57, 3400, 189),
  distanza("UTS 100M", "UK", "GBP", 167, 9600, 299),
];

function indiceVsRiferimento(d: ReturnType<typeof distanza>) {
  const rif = scegliRiferimento(d, RIFERIMENTI);
  if (!rif) throw new Error(`nessun riferimento per ${d.nome}`);
  return { riferimento: rif.nome, indice: indiceBenchmark(d.costoKmSforzo, rif.costoKmSforzo) };
}

function prezzo(over: Partial<PrezzoConfrontabile>): PrezzoConfrontabile {
  return {
    prezzo: 100,
    valuta: "EUR",
    scaglione: "standard",
    includeIva: null,
    includeCommissioni: null,
    km: 50,
    dplus: 2600,
    ...over,
  };
}

describe("kmSforzo", () => {
  it("50 km con 3.000 m D+ = 80 km-sforzo (esempio di progetto.md)", () => {
    expect(kmSforzo(50, 3000)).toBe(80);
  });

  it("rifiuta km non positivi e D+ negativo", () => {
    expect(() => kmSforzo(0, 100)).toThrow(RangeError);
    expect(() => kmSforzo(10, -1)).toThrow(RangeError);
  });
});

describe("costoKmSforzo", () => {
  it("Lavaredo 120K 2027 ≈ 1,80 €/km-sforzo", () => {
    expect(costoKmSforzo(320.31, kmSforzo(120, 5800))).toBeCloseTo(1.7995, 4);
  });

  it("Lavaredo 50K 2027 ≈ 2,29 €/km-sforzo", () => {
    expect(costoKmSforzo(173.84, kmSforzo(50, 2600))).toBeCloseTo(2.287, 3);
  });

  it("rifiuta km-sforzo non positivi", () => {
    expect(() => costoKmSforzo(10, 0)).toThrow(RangeError);
  });
});

describe("scegliRiferimento e indiceBenchmark (regola: distanza più simile)", () => {
  it("Adamello 170 = −53% vs Lavaredo 120K (esempio di CLAUDE.md)", () => {
    const r = indiceVsRiferimento(distanza("Adamello AUT 170", "IT", "EUR", 170, 11500, 240));
    expect(r.riferimento).toBe("Lavaredo 120K");
    expect(Math.round(r.indice * 100)).toBe(-53);
  });

  it("Trabucco 15K = −59% vs Lavaredo 50K", () => {
    const r = indiceVsRiferimento(distanza("Trabucco 15K", "IT", "EUR", 15.5, 1332, 27));
    expect(r.riferimento).toBe("Lavaredo 50K");
    expect(Math.round(r.indice * 100)).toBe(-59);
  });

  it("Scafell Sky Ultra = −35% vs UTS 50K", () => {
    const r = indiceVsRiferimento(distanza("Scafell 60K", "UK", "GBP", 60, 4400, 140));
    expect(r.riferimento).toBe("UTS 50K");
    expect(Math.round(r.indice * 100)).toBe(-35);
  });

  it("Lakeland 100 = −17% vs UTS 100M", () => {
    const r = indiceVsRiferimento(distanza("Lakeland 100", "UK", "GBP", 169, 6300, 220));
    expect(r.riferimento).toBe("UTS 100M");
    expect(Math.round(r.indice * 100)).toBe(-17);
  });

  it("un riferimento confrontato con sé stesso ha indice 0", () => {
    const r = indiceVsRiferimento(RIFERIMENTI[2]);
    expect(r.riferimento).toBe("Lavaredo 120K");
    expect(r.indice).toBe(0);
  });

  it("non usa riferimenti di un altro paese o di un'altra valuta", () => {
    const soloItalia = RIFERIMENTI.filter((r) => r.paese === "IT");
    expect(scegliRiferimento({ paese: "UK", valuta: "GBP", kmSforzo: 100 }, soloItalia)).toBeNull();
    expect(scegliRiferimento({ paese: "IT", valuta: "GBP", kmSforzo: 100 }, soloItalia)).toBeNull();
  });

  it("rifiuta un riferimento con costo non positivo", () => {
    expect(() => indiceBenchmark(1, 0)).toThrow(RangeError);
  });
});

describe("aumentoYoy e badgeAumento", () => {
  it("Lavaredo 50K: 119,90 → 173,84 € = +45%, badge rosso", () => {
    const esito = aumentoYoy(prezzo({ prezzo: 173.84 }), prezzo({ prezzo: 119.9 }));
    expect(esito.tipo).toBe("prezzo");
    if (esito.tipo !== "prezzo") return;
    expect(Math.round(esito.valore * 100)).toBe(45);
    expect(badgeAumento(esito)).toBe("rosso");
  });

  it("Lakeland 100: 190 → 220 £ = +16%, badge rosso", () => {
    const esito = aumentoYoy(
      prezzo({ prezzo: 220, valuta: "GBP", km: 169, dplus: 6300 }),
      prezzo({ prezzo: 190, valuta: "GBP", km: 169, dplus: 6300 }),
    );
    expect(badgeAumento(esito)).toBe("rosso");
  });

  it("The Fellsman: 100 → 110 £ = +10%, nessun badge", () => {
    const esito = aumentoYoy(
      prezzo({ prezzo: 110, valuta: "GBP" }),
      prezzo({ prezzo: 100, valuta: "GBP" }),
    );
    expect(esito).toEqual({ tipo: "prezzo", valore: expect.closeTo(0.1, 10) });
    expect(badgeAumento(esito)).toBeNull();
  });

  it("esattamente +15% non fa scattare il badge (soglia: oltre +15%)", () => {
    expect(badgeAumento(aumentoYoy(prezzo({ prezzo: 115 }), prezzo({ prezzo: 100 })))).toBeNull();
  });

  it("non confronta scaglioni diversi (early con standard)", () => {
    const esito = aumentoYoy(prezzo({ scaglione: "standard" }), prezzo({ scaglione: "early" }));
    expect(esito).toEqual({ tipo: "non_confrontabile", motivo: "scaglione" });
    expect(badgeAumento(esito)).toBeNull();
  });

  it("non confronta valute diverse", () => {
    expect(aumentoYoy(prezzo({ valuta: "EUR" }), prezzo({ valuta: "GBP" }))).toEqual({
      tipo: "non_confrontabile",
      motivo: "valuta",
    });
  });

  it("non confronta basi diverse (IVA o commissioni)", () => {
    expect(aumentoYoy(prezzo({ includeIva: true }), prezzo({ includeIva: false }))).toEqual({
      tipo: "non_confrontabile",
      motivo: "base",
    });
    expect(
      aumentoYoy(prezzo({ includeCommissioni: true }), prezzo({ includeCommissioni: null })),
    ).toEqual({ tipo: "non_confrontabile", motivo: "base" });
  });

  it("se il percorso cambia confronta il costo per km-sforzo", () => {
    // Stesso prezzo, ma 80 km-sforzo → 100 km-sforzo: il costo per km-sforzo scende del 20%.
    const esito = aumentoYoy(
      prezzo({ prezzo: 100, km: 60, dplus: 4000 }),
      prezzo({ prezzo: 100, km: 50, dplus: 3000 }),
    );
    expect(esito.tipo).toBe("percorso_modificato");
    if (esito.tipo !== "percorso_modificato") return;
    expect(esito.valore).toBeCloseTo(-0.2, 10);
  });
});

describe("fasciaPrezzo", () => {
  it("Adamello AUT 170 (0,84) → costa il giusto", () => {
    expect(fasciaPrezzo(0.842, 170, "piccola")).toBe("giusto");
  });

  it("Colmen CT22 (21,5 km, 1,003): sotto 30 km vale la soglia 1,20 → costa il giusto", () => {
    expect(fasciaPrezzo(costoKmSforzo(35, kmSforzo(21.5, 1340)), 21.5, "piccola")).toBe("giusto");
  });

  it("Rosengarten 46K (1,05) → sopra soglia", () => {
    expect(fasciaPrezzo(costoKmSforzo(80, kmSforzo(46, 3000)), 46, "piccola")).toBe("sopra_soglia");
  });

  it("Lakeland 50 (1,71), pur marcata 'piccola' → fascia grandi circuiti", () => {
    expect(fasciaPrezzo(costoKmSforzo(190, kmSforzo(80, 3100)), 80, "piccola")).toBe(
      "grandi_circuiti",
    );
  });

  it("Borrowdale (fell race, 0,34) → categoria a parte", () => {
    expect(fasciaPrezzo(0.34, 27, "fell_race")).toBe("categoria_a_parte");
    expect(fasciaPrezzo(0.34, 27, "club")).toBe("categoria_a_parte");
  });

  it("limiti: 30 km è gara lunga; 1,00 e 1,20 inclusi nel giusto; 1,50 incluso nel sopra soglia", () => {
    expect(fasciaPrezzo(1.0, 30, "piccola")).toBe("giusto");
    expect(fasciaPrezzo(1.1, 30, "piccola")).toBe("sopra_soglia");
    expect(fasciaPrezzo(1.1, 29.9, "piccola")).toBe("giusto");
    expect(fasciaPrezzo(36 / 30, 20, "piccola")).toBe("giusto"); // 1,2 con errore di arrotondamento
    expect(fasciaPrezzo(1.5, 50, "grande_circuito")).toBe("sopra_soglia");
    expect(fasciaPrezzo(1.51, 50, "grande_circuito")).toBe("grandi_circuiti");
  });
});
