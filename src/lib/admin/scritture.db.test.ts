// Test d'integrazione su un Postgres VERO ma usa e getta: girano solo con TEST_DATABASE_URL
// (es. postgres://fairkm@localhost:54329/fairkm_prova). Cancellano e ricreano lo schema: MAI il database di Render.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creaPool } from "../db";
import { importaGare } from "../importa-csv";
import { applicaMigrazioni } from "../migrazioni";
import { approvaNuovaGara, inserisciDati, leggiVoce, salvaBozza, scarta } from "./scritture";

const URL = process.env.TEST_DATABASE_URL;
const OGGI = "2026-11-13";
const EMAIL = "redazione@example.com";

const RIGA = {
  evento: "Trail di Prova", distanza: "Lungo", paese: "IT", zona: "Bergamo (BG), Lombardia", categoria: "piccola",
  riferimento_nazionale: "no", edizione: "2026", km: "42", dplus: "2500", prezzo: "55", valuta: "EUR",
  scaglione: "standard", fonte_url: "https://example.org/regolamento", fonte_tipo: "primaria ufficiale",
  data_verifica: "2026-11-10",
};

describe.skipIf(!URL)("scritture della redazione (Postgres locale)", () => {
  let db: Pool;

  beforeAll(async () => {
    if (URL && /render\.com|onrender/.test(URL)) throw new Error("TEST_DATABASE_URL punta a Render: mai");
    db = creaPool(URL);
    const client = await db.connect();
    try {
      await client.query("drop schema public cascade; create schema public;");
      await applicaMigrazioni(client);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await db?.end();
  });

  // Ogni test parte dai dati d'esempio (75 gare) e da una coda vuota.
  beforeEach(async () => {
    await db.query("truncate review_queue, prices, distances, races restart identity cascade");
    const dati = importaGare(readFileSync(join(process.cwd(), "test/gare-esempio.csv"), "utf8"));
    const client = await db.connect();
    try {
      for (const distance of dati.distances) {
        const race = dati.races.find((r) => r.id === distance.raceId)!;
        await inserisciDati(client, { race, distance, prices: dati.prices.filter((p) => p.distanceId === distance.id) });
      }
    } finally {
      client.release();
    }
  });

  async function proponi(riga: Record<string, string>, chiave = "it-trail-di-prova--lungo"): Promise<number> {
    const { rows } = await db.query(
      `insert into review_queue (origine, diff_testo, proposta) values ('nuova_gara', 'da completare', $1) returning id`,
      [{ chiave, riga }],
    );
    return Number(rows[0].id);
  }

  const conta = async (sql: string, valori: unknown[] = []) => Number((await db.query(sql, valori)).rows[0].n);

  it("approva: pubblica gara, distanza e prezzo, e registra chi ha chiuso la voce", async () => {
    const id = await proponi({});
    expect(await approvaNuovaGara(db, id, RIGA, EMAIL, OGGI)).toEqual({ ok: true });
    expect(await conta("select count(*) n from races where id = 'it-trail-di-prova'")).toBe(1);
    const prezzo = (await db.query("select prezzo, fonte_tipo, data_rilevazione from prices where distance_id = 'it-trail-di-prova--lungo'")).rows;
    expect(prezzo).toEqual([{ prezzo: 55, fonte_tipo: "primaria ufficiale", data_rilevazione: "2026-11-10" }]);
    const voce = await leggiVoce(db, id);
    expect([voce?.stato, voce?.chiusoDa]).toEqual(["approvata", EMAIL]);
    expect(voce?.chiusoIl).not.toBeNull();
    expect(voce?.riga.evento).toBe("Trail di Prova");
  });

  it("non approva una fonte non primaria: niente pubblicato, la riga resta salvata in bozza", async () => {
    const id = await proponi({});
    const esito = await approvaNuovaGara(db, id, { ...RIGA, fonte_tipo: "secondaria" }, EMAIL, OGGI);
    expect(esito.ok).toBe(false);
    expect(await conta("select count(*) n from distances where id = 'it-trail-di-prova--lungo'")).toBe(0);
    const voce = await leggiVoce(db, id);
    expect([voce?.stato, voce?.riga.fonte_tipo]).toEqual(["aperta", "secondaria"]);
  });

  it("nuova distanza di una gara esistente: la gara non viene toccata", async () => {
    const prima = (await db.query("select * from races where id = 'it-gubbio-trail-citta-di-pietra'")).rows[0];
    const id = await proponi({});
    const riga = { ...RIGA, evento: "Gubbio Trail Città di Pietra", distanza: "Gubbio 10K", zona: "Altrove", fonte_storico_url: "" };
    expect(await approvaNuovaGara(db, id, riga, EMAIL, OGGI)).toEqual({ ok: true });
    expect((await db.query("select * from races where id = 'it-gubbio-trail-citta-di-pietra'")).rows[0]).toEqual(prima);
    expect(await conta("select count(*) n from distances where race_id = 'it-gubbio-trail-citta-di-pietra'")).toBe(3);
  });

  it("rifiuta una distanza che esiste già e una gara esistente con altra categoria", async () => {
    const id = await proponi({});
    const doppia = { ...RIGA, evento: "Gubbio Trail Città di Pietra", distanza: "Gubbio Trail Città di Pietra 25K" };
    const esito = await approvaNuovaGara(db, id, doppia, EMAIL, OGGI);
    expect(esito.ok ? "" : esito.errori.join()).toMatch(/esiste già/);
    const categoria = await approvaNuovaGara(db, id, { ...doppia, distanza: "Nuova", categoria: "club" }, EMAIL, OGGI);
    expect(categoria.ok ? "" : categoria.errori.join()).toMatch(/categoria/);
    expect((await leggiVoce(db, id))?.stato).toBe("aperta");
  });

  it("una voce si chiude una volta sola", async () => {
    const id = await proponi({});
    expect((await approvaNuovaGara(db, id, RIGA, EMAIL, OGGI)).ok).toBe(true);
    expect((await approvaNuovaGara(db, id, RIGA, EMAIL, OGGI)).ok).toBe(false);
    expect((await scarta(db, id, EMAIL)).ok).toBe(false);
    expect(await conta("select count(*) n from prices where distance_id = 'it-trail-di-prova--lungo'")).toBe(1);
  });

  it("due approvazioni insieme pubblicano una volta sola", async () => {
    const id = await proponi({});
    const esiti = await Promise.all([1, 2, 3].map(() => approvaNuovaGara(db, id, RIGA, EMAIL, OGGI)));
    expect(esiti.filter((e) => e.ok)).toHaveLength(1);
    expect(await conta("select count(*) n from distances where id = 'it-trail-di-prova--lungo'")).toBe(1);
  });

  it("scarta: chiude senza pubblicare, con chi e quando", async () => {
    const id = await proponi(RIGA);
    expect(await scarta(db, id, EMAIL)).toEqual({ ok: true });
    const voce = await leggiVoce(db, id);
    expect([voce?.stato, voce?.chiusoDa]).toEqual(["scartata", EMAIL]);
    expect(await conta("select count(*) n from distances where id = 'it-trail-di-prova--lungo'")).toBe(0);
  });

  it("salva bozza: aggiorna la riga normalizzata, solo se la voce è aperta", async () => {
    const id = await proponi({ evento: "Vecchio" });
    expect(await salvaBozza(db, id, { ...RIGA, km: "42.4567", paese: "it" })).toEqual({ ok: true });
    const voce = await leggiVoce(db, id);
    expect([voce?.riga.km, voce?.riga.paese, voce?.chiave]).toEqual(["42.46", "IT", "it-trail-di-prova--lungo"]);
    await scarta(db, id, EMAIL);
    expect((await salvaBozza(db, id, RIGA)).ok).toBe(false);
  });

  it("chi chiude è registrato solo sulle voci chiuse (vincolo 0004)", async () => {
    const id = await proponi({});
    await expect(db.query("update review_queue set chiuso_da = 'x' where id = $1", [id])).rejects.toThrow();
  });
});
