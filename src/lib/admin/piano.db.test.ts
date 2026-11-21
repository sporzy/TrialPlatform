// Test d'integrazione del piano della redazione su un Postgres usa e getta (TEST_DATABASE_URL), mai quello di Render.

import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { databaseDiProva } from "../db-prova";
import { applicaPiano, type Piano } from "./piano";

const URL = process.env.TEST_DATABASE_URL;

const RIGA = {
  evento: "Trail di Prova", distanza: "Lungo", paese: "IT", zona: "Bergamo (BG), Lombardia", categoria: "piccola",
  riferimento_nazionale: "no", edizione: "2026", km: "42", dplus: "2500", prezzo: "55", valuta: "EUR",
  scaglione: "standard", fonte_url: "https://example.org/regolamento", fonte_tipo: "primaria ufficiale",
  data_verifica: "2026-11-20", sito: "https://example.org/",
};

describe.skipIf(!URL)("piano della redazione (Postgres locale)", () => {
  let db: Pool;

  beforeAll(async () => {
    db = await databaseDiProva(process.env.TEST_DATABASE_URL!, "prova_piano");
  });
  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await db.query("truncate review_queue, prices, distances, races restart identity cascade");
    await db.query(
      `insert into races (id, nome, paese, categoria) values ('uk-gara-esistente', 'Gara Esistente', 'UK', 'piccola')`,
    );
    for (const [chiave, motivo] of [
      ["it-trail-di-prova--lungo", "da completare"],
      ["it-trail-di-prova--corto", "da completare"],
      ["it-da-scartare--x", "da completare"],
    ]) {
      await db.query(`insert into review_queue (origine, diff_testo, proposta) values ('nuova_gara', $1, $2)`, [
        motivo, { chiave, riga: {} },
      ]);
    }
  });

  const piano: Piano = {
    chiusoDa: "prova",
    oggi: "2026-11-21",
    voci: [
      { originale: { paese: "IT", evento: "Trail di Prova", distanza: "Lungo" }, azione: "approva", riga: RIGA },
      { originale: { paese: "IT", evento: "Trail di Prova", distanza: "Corto" }, azione: "bozza", riga: { ...RIGA, distanza: "Corto", prezzo: "" }, motivo: "manca il prezzo" },
      { originale: { paese: "IT", evento: "Da scartare", distanza: "X" }, azione: "scarta", motivo: "non esiste più" },
    ],
    siti: [{ paese: "UK", evento: "Gara Esistente", sito: "https://esistente.example.org/" }],
  };

  const stati = async () =>
    (await db.query(`select proposta ->> 'chiave' as k, stato, diff_testo from review_queue where origine = 'nuova_gara' order by id`)).rows;

  it("in prova non scrive nulla", async () => {
    const prima = await stati();
    const out = await applicaPiano(db, piano, true);
    expect(out.at(-1)).toMatch(/1 approvate, 1 scartate, 1 bozze, 1 siti, 0 saltate, 0 errori/);
    expect(await stati()).toEqual(prima);
    expect((await db.query(`select sito from races where id = 'uk-gara-esistente'`)).rows[0].sito).toBeNull();
  });

  it("applica: pubblica, scarta, salva in bozza, aggiunge il sito con la traccia; rilanciato non ripete nulla", async () => {
    const out = await applicaPiano(db, piano, false);
    expect(out.at(-1)).toMatch(/1 approvate, 1 scartate, 1 bozze, 1 siti, 0 saltate, 0 errori/);
    expect((await stati()).map((r) => r.stato)).toEqual(["approvata", "aperta", "scartata"]);
    expect((await db.query(`select sito from races where id = 'it-trail-di-prova'`)).rows[0].sito).toBe("https://example.org/");
    expect((await db.query(`select sito from races where id = 'uk-gara-esistente'`)).rows[0].sito).toBe("https://esistente.example.org/");
    const traccia = (await db.query(`select diff_testo, chiuso_da from review_queue where origine = 'modifica_manuale'`)).rows;
    expect(traccia).toEqual([{ diff_testo: "gara.sito: — → https://esistente.example.org/", chiuso_da: "prova" }]);

    const ancora = await applicaPiano(db, piano, false);
    expect(ancora.at(-1)).toMatch(/0 approvate, 0 scartate, 1 bozze, 0 siti, 2 saltate, 0 errori/);
    const bozza = (await stati())[1].diff_testo as string;
    expect(bozza.match(/manca il prezzo/g)).toHaveLength(1);
  });

  it("non sovrascrive un sito già messo dalla redazione", async () => {
    await db.query(`update races set sito = 'https://scelto.example.org/' where id = 'uk-gara-esistente'`);
    const out = await applicaPiano(db, { ...piano, voci: [] }, false);
    expect(out.join("\n")).toMatch(/SALTATO {2}sito di uk-gara-esistente/);
    expect((await db.query(`select sito from races where id = 'uk-gara-esistente'`)).rows[0].sito).toBe("https://scelto.example.org/");
  });
});
