import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costruisciElenco, etichettaDistanza, prezzoCorrente, prezzoPrecedente } from "./elenco";
import { importaGare } from "./importa-csv";
import type { Price } from "./tipi";

const sezioni = costruisciElenco(importaGare(readFileSync(join(process.cwd(), "data/gare.csv"), "utf8")));
const riga = (id: string) => {
  const trovata = sezioni.flatMap((s) => s.righe).find((r) => r.distanceId === id);
  if (!trovata) throw new Error(`riga ${id} non trovata`);
  return trovata;
};

function prezzo(over: Partial<Price>): Price {
  return {
    distanceId: "x", edizione: 2026, prezzo: 50, valuta: "EUR", scaglione: "standard",
    includeIva: null, includeCommissioni: null, fonteUrl: null, dataRilevazione: null,
    validoDal: null, validoFino: null, finoAIscritti: null, ordine: 1, ...over,
  };
}

describe("prezzoCorrente e prezzoPrecedente", () => {
  const prezzi = [
    prezzo({ edizione: 2026, scaglione: "early", prezzo: 40 }),
    prezzo({ edizione: 2027, scaglione: "early", prezzo: 45 }),
    prezzo({ edizione: 2026, scaglione: "standard", prezzo: 50 }),
    prezzo({ edizione: 2027, scaglione: "standard", prezzo: 55 }),
  ];

  it("corrente: edizione più recente, scaglione standard se c'è", () => {
    expect(prezzoCorrente(prezzi)?.prezzo).toBe(55);
    expect(prezzoCorrente(prezzi.filter((p) => p.scaglione === "early"))?.prezzo).toBe(45);
    expect(prezzoCorrente([])).toBeNull();
  });

  it("precedente: edizione precedente, stesso scaglione del corrente", () => {
    expect(prezzoPrecedente(prezzi, prezzi[3])?.prezzo).toBe(50);
    expect(prezzoPrecedente(prezzi, prezzi[1])?.prezzo).toBe(40);
    expect(prezzoPrecedente(prezzi, prezzi[0])).toBeNull();
  });
});

describe("etichettaDistanza", () => {
  it("non ripete il nome della gara", () => {
    expect(etichettaDistanza("Trail del Drago", "Trail del Drago 10K")).toBe("10K");
    expect(etichettaDistanza("North Downs Way 100", "North Downs Way 100")).toBe("");
    expect(etichettaDistanza("Trailaghi", "Trail dei Canottieri")).toBe("Trail dei Canottieri");
  });
});

describe("costruisciElenco con data/gare.csv", () => {
  it("una sezione per paese: Italia (51) e Regno Unito (52)", () => {
    expect(sezioni.map((s) => [s.nomePaese, s.righe.length])).toEqual([
      ["Italia", 51],
      ["Regno Unito", 52],
    ]);
  });

  it("ogni sezione ha una sola valuta ed è ordinata per costo crescente", () => {
    for (const s of sezioni) {
      expect(new Set(s.righe.map((r) => r.prezzo.valuta)).size).toBe(1);
      const costi = s.righe.map((r) => r.costoKmSforzo);
      expect(costi).toEqual([...costi].sort((a, b) => a - b));
    }
  });

  it("Lavaredo 120K è un riferimento: indice 0 rispetto a sé stessa, fascia grandi circuiti", () => {
    const r = riga("it-lavaredo-ultra-trail--120k");
    expect(r.riferimentoNazionale).toBe(true);
    expect(r.confronto).toEqual({ riferimento: "Lavaredo Ultra Trail 120K", indice: 0 });
    expect(r.fascia).toBe("grandi_circuiti");
  });

  it("Lavaredo 50K: aumento +45% sul 2026, badge rosso", () => {
    const r = riga("it-lavaredo-ultra-trail--50k");
    expect(r.aumento?.tipo).toBe("prezzo");
    expect(r.aumento?.tipo === "prezzo" && Math.round(r.aumento.valore * 100)).toBe(45);
    expect(r.badgeAumento).toBe("rosso");
  });

  it("Trail del Drago 10K: distanza '10K', confrontata con Lavaredo 50K (la più simile)", () => {
    const r = riga("it-trail-del-drago--trail-del-drago-10k");
    expect(r.distanza).toBe("10K");
    expect(r.kmSforzo).toBe(16);
    expect(r.confronto?.riferimento).toBe("Lavaredo Ultra Trail 50K");
    expect(r.aumento).toBeNull();
  });

  it("Dragon 100: 160 → 180 £ = +13%, nessun badge", () => {
    const r = riga("uk-dragon-coastal-races--dragon-100");
    expect(r.aumento?.tipo === "prezzo" && Math.round(r.aumento.valore * 100)).toBe(13);
    expect(r.badgeAumento).toBeNull();
  });

  it("le gare britanniche si confrontano con UTS, mai con Lavaredo", () => {
    const uk = sezioni.find((s) => s.paese === "UK")!;
    expect(uk.righe.every((r) => r.confronto?.riferimento.startsWith("Ultra-Trail Snowdonia"))).toBe(true);
  });
});
