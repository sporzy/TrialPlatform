// Test d'integrazione della notte di controllo su un Postgres locale usa e getta (TEST_DATABASE_URL), con pagine
// finte in memoria: nessuna richiesta in rete, mai il database di Render.

import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { inserisciDati } from "../admin/scritture";
import { databaseDiProva } from "../db-prova";
import type { DatiRiga } from "../importa-csv";
import { eseguiNotte } from "./notte";
import type { EsitoScarico } from "./scarica";
import { righeUtili, testoDaHtml } from "./testo";

const URL_DB = process.env.TEST_DATABASE_URL;
const PAGINA = "https://gara.example/regolamento";
const PDF = "https://altra.example/reg.pdf";

function riga(raceId: string, distanza: string, prezzo: number, fonte: string, edizione = 2026): DatiRiga {
  const distanceId = `${raceId}--${distanza}`;
  return {
    race: { id: raceId, nome: raceId, paese: "IT", regione: null, organizzatore: null, sito: null, categoria: "piccola",
      qualificaUtmb: false, itra: null, fonteStoricoUrl: null },
    distance: { id: distanceId, raceId, nome: distanza, km: 25, dplus: 1000, cancelli: null, materialeObbligatorio: null,
      gpxUrl: null, riferimentoNazionale: false, note: null, altreFontiUrl: [] },
    prices: [{ distanceId, edizione, prezzo, valuta: "EUR", scaglione: "standard", includeIva: null, includeCommissioni: null,
      fonteUrl: fonte, fonteTipo: "primaria ufficiale", dataRilevazione: "2026-10-08", validoDal: null, validoFino: null,
      finoAIscritti: null, ordine: 1 }],
  };
}

function pagina(html: string): EsitoScarico {
  const testo = testoDaHtml(html);
  const righe = righeUtili(testo);
  return { stato: "ok", formato: "pagina", righe, testo, impronta: righe.join("|"), urlFinale: PAGINA };
}

describe.skipIf(!URL_DB)("notte di controllo (Postgres locale)", () => {
  let db: Pool;
  let web: Record<string, EsitoScarico>;
  const scarica = async (url: string) => web[url] ?? { stato: "errore" as const, dettaglio: "il sito risponde 404" };
  const notte = (prova = false, oggi = "2026-11-15") => eseguiNotte(db, { prova, oggi, scarica, pausaMs: 0 });
  // Ogni notte di test è "la notte dopo": si dimentica l'ora dell'ultimo controllo.
  const passaUnGiorno = () => db.query("update sources set ultimo_controllo = null");
  const q = async (sql: string, v: unknown[] = []) => (await db.query(sql, v)).rows;

  beforeAll(async () => {
    db = await databaseDiProva(process.env.TEST_DATABASE_URL!, "prova_notte");
  });
  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await db.query("truncate controlli_notturni, review_queue, sources, prices, distances, races restart identity cascade");
    const c = await db.connect();
    try {
      await inserisciDati(c, riga("it-gara", "corto", 35, PAGINA));
      await inserisciDati(c, { ...riga("it-gara", "lungo", 60, PAGINA), race: riga("it-gara", "lungo", 60, PAGINA).race });
      await inserisciDati(c, riga("it-altra", "unica", 40, PDF));
    } finally {
      c.release();
    }
    web = {
      [PAGINA]: pagina("<p>Quote: Corto 35 €, Lungo € 60,00</p><p>Posti rimasti: 10</p>"),
      [PDF]: { stato: "ok", formato: "pdf", impronta: "pdf-v1", urlFinale: PDF },
    };
  });

  it("prima notte: niente conferme; i prezzi non trovati diventano una voce da riverificare", async () => {
    web[PAGINA] = pagina("<p>Quote: Corto 35 €, Lungo 65 €</p>");
    const r = (await notte())!;
    expect(r.conteggi.prima_volta).toBe(2);
    expect(await q("select count(*)::int n from prices where confermato_il is not null")).toEqual([{ n: 0 }]);
    const voci = await q("select origine, diff_testo, proposta from review_queue");
    expect(voci).toHaveLength(1);
    expect(voci[0].origine).toBe("cambio_fonte");
    expect(voci[0].proposta.mancanti).toEqual(["it-gara--lungo: 60 EUR (2026)"]);
  });

  it("notte dopo, pagina invariata e prezzi trovati: conferma automatica, senza toccare la data di chi ha verificato", async () => {
    await notte();
    await passaUnGiorno();
    // Cambia solo un contatore: non è una notizia.
    web[PAGINA] = pagina("<p>Quote: Corto 35 €, Lungo € 60,00</p><p>Posti rimasti: 3</p>");
    const r = (await notte(false, "2026-11-16"))!;
    expect(r.conteggi.conferma).toBe(1);
    expect(await q("select distance_id, data_rilevazione, confermato_il from prices order by distance_id")).toEqual([
      { distance_id: "it-altra--unica", data_rilevazione: "2026-10-08", confermato_il: null },
      { distance_id: "it-gara--corto", data_rilevazione: "2026-10-08", confermato_il: "2026-11-16" },
      { distance_id: "it-gara--lungo", data_rilevazione: "2026-10-08", confermato_il: "2026-11-16" },
    ]);
    expect(await q("select count(*)::int n from review_queue")).toEqual([{ n: 0 }]);
  });

  it("i PDF non si confermano mai da soli; se cambiano, voce in coda", async () => {
    await notte();
    await passaUnGiorno();
    await notte();
    expect(await q("select confermato_il from prices where distance_id = 'it-altra--unica'")).toEqual([{ confermato_il: null }]);
    await passaUnGiorno();
    web[PDF] = { stato: "ok", formato: "pdf", impronta: "pdf-v2", urlFinale: PDF };
    expect((await notte())!.conteggi.pdf_cambiato).toBe(1);
    expect((await q("select diff_testo from review_queue"))[0].diff_testo).toMatch(/PDF è cambiato/);
  });

  it("pagina cambiata: voce con righe tolte e aggiunte; un altro cambiamento aggiorna la stessa voce", async () => {
    await notte();
    await passaUnGiorno();
    web[PAGINA] = pagina("<p>Quote: Corto 38 €, Lungo € 60,00</p>");
    await notte();
    let voci = await q("select id, proposta from review_queue where stato = 'aperta'");
    expect(voci).toHaveLength(1);
    expect(voci[0].proposta.tolte).toEqual(["Quote: Corto 35 €, Lungo € 60,00"]);
    expect(voci[0].proposta.aggiunte).toEqual(["Quote: Corto 38 €, Lungo € 60,00"]);
    expect(voci[0].proposta.mancanti).toEqual(["it-gara--corto: 35 EUR (2026)"]);
    await passaUnGiorno();
    web[PAGINA] = pagina("<p>Quote: Corto 39 €, Lungo € 60,00</p>");
    await notte();
    voci = await q("select id, proposta from review_queue where stato = 'aperta'");
    expect(voci).toHaveLength(1);
    expect(voci[0].proposta.aggiunte).toEqual(["Quote: Corto 39 €, Lungo € 60,00"]);
    expect(await q("select count(*)::int n from prices where confermato_il is not null")).toEqual([{ n: 0 }]);
  });

  it("link rotto solo dopo 3 notti di errori; un ritorno alla normalità azzera il conto", async () => {
    await notte();
    delete web[PAGINA];
    for (const attesa of [0, 0, 1]) {
      await passaUnGiorno();
      await notte();
      expect(await q("select count(*)::int n from review_queue where origine = 'link_rotto'")).toEqual([{ n: attesa }]);
    }
    const [fonte] = await q("select errori_consecutivi, esito, errore from sources where url = $1", [PAGINA]);
    expect(fonte).toEqual({ errori_consecutivi: 3, esito: "errore", errore: "il sito risponde 404" });
    web[PAGINA] = pagina("<p>Quote: Corto 35 €, Lungo € 60,00</p>");
    await passaUnGiorno();
    await notte();
    expect((await q("select errori_consecutivi from sources where url = $1", [PAGINA]))[0].errori_consecutivi).toBe(0);
  });

  it("notte di prova: aggiorna lo stato delle fonti, ma non tocca prezzi né coda; il riepilogo dice cosa avrebbe fatto", async () => {
    web[PAGINA] = pagina("<p>Quote: Corto 35 €</p>");
    const r = (await notte(true))!;
    expect(r.prova).toBe(true);
    expect(r.esiti.find((e) => e.url === PAGINA)?.mancanti).toEqual(["it-gara--lungo: 60 EUR (2026)"]);
    expect(await q("select count(*)::int n from review_queue")).toEqual([{ n: 0 }]);
    await passaUnGiorno();
    expect((await notte(true))!.conteggi.invariata_prezzo_mancante).toBe(1);
    expect(await q("select count(*)::int n from prices where confermato_il is not null")).toEqual([{ n: 0 }]);
    expect(await q("select prova, riepilogo is not null as ok from controlli_notturni order by id")).toEqual([
      { prova: true, ok: true }, { prova: true, ok: true },
    ]);
  });

  it("una fonte controllata da poco si salta; due notti insieme: parte solo la prima", async () => {
    await notte();
    expect((await notte())!.conteggi.saltata).toBe(2);
    const [a, b] = await Promise.all([notte(), notte()]);
    expect([a, b].filter((x) => x === null)).toHaveLength(1);
  });

  it("i prezzi delle edizioni passate non si confermano", async () => {
    const c = await db.connect();
    try {
      await c.query(
        `insert into prices (distance_id, edizione, prezzo, valuta, scaglione, fonte_url, fonte_tipo, data_rilevazione)
         values ('it-gara--corto', 2025, 30, 'EUR', 'standard', $1, 'primaria ufficiale', '2026-10-08')`,
        [PAGINA],
      );
    } finally {
      c.release();
    }
    web[PAGINA] = pagina("<p>Quote: Corto 35 € (2025: 30 €), Lungo € 60,00</p>");
    await notte();
    await passaUnGiorno();
    await notte();
    expect(await q("select edizione, confermato_il from prices where distance_id = 'it-gara--corto' order by edizione")).toEqual([
      { edizione: 2025, confermato_il: null },
      { edizione: 2026, confermato_il: "2026-11-15" },
    ]);
  });
});
