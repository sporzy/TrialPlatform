import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIE, SCAGLIONI, TIPI_COSTO_NASCOSTO } from "./tipi";

// Lo schema SQL e i tipi TypeScript devono ammettere gli stessi valori.
const schema = readFileSync(join(process.cwd(), "db/migrations/0001_schema.sql"), "utf8");

function valoriCheck(colonna: string): string[] {
  const match = schema.match(new RegExp(`check \\(${colonna} in \\(([^)]*)\\)\\)`));
  if (!match) throw new Error(`CHECK su "${colonna}" non trovato nello schema`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("schema SQL allineato a tipi.ts", () => {
  it("categoria", () => {
    expect(valoriCheck("categoria")).toEqual([...CATEGORIE]);
  });

  it("scaglione", () => {
    expect(valoriCheck("scaglione")).toEqual([...SCAGLIONI]);
  });

  it("tipo dei costi nascosti", () => {
    expect(valoriCheck("tipo")).toEqual([...TIPI_COSTO_NASCOSTO]);
  });

  it("il prezzo non è una colonna di races né di distances", () => {
    const tabella = (nome: string) => schema.match(new RegExp(`create table ${nome} \\(([\\s\\S]*?)\\n\\);`))?.[1];
    expect(tabella("races")).toBeDefined();
    expect(tabella("distances")).toBeDefined();
    expect(tabella("races")).not.toMatch(/\bprezzo\b/);
    expect(tabella("distances")).not.toMatch(/\bprezzo\b/);
  });
});
