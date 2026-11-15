// Una notte di controllo delle fonti, con la "via di mezzo" (CLAUDE.md, "Controllo notturno"):
// - pagina invariata dalla notte prima E ogni prezzo in corso trovato sulla pagina → conferma automatica (confermato_il);
// - pagina o PDF cambiati, prezzi non più trovati → una voce in coda per fonte (aggiornata, mai duplicata);
// - errori per più notti di fila → avviso "link rotto" in coda;
// - in prova: si aggiorna solo lo stato delle fonti (per confrontare la notte dopo), mai prezzi né coda.

import type { Pool, PoolClient } from "pg";
import { confrontaRighe, prezzoPresente } from "./testo";
import { Robots, scaricaFonte, type EsitoScarico } from "./scarica";

export const NOTTI_PRIMA_DI_LINK_ROTTO = 3;
/** Una fonte controllata da meno di così non si ricontrolla (es. due avvii nella stessa notte). */
const ORE_TRA_CONTROLLI = 20;
const PAUSA_TRA_PAGINE_MS = 2_000;
const SITI_IN_PARALLELO = 4;
const LOCK = 7_402_016;

type Scarica = (url: string) => Promise<EsitoScarico>;

export interface OpzioniNotte {
  prova: boolean;
  /** Data di oggi (AAAA-MM-GG) in Italia. */
  oggi: string;
  scarica?: Scarica;
  pausaMs?: number;
}

interface PrezzoInCorso {
  id: number;
  distanceId: string;
  prezzo: number;
  valuta: string;
  edizione: number;
}

interface Fonte {
  id: number;
  raceId: string;
  url: string;
  testoUtile: string | null;
  ultimoHash: string | null;
  errori: number;
  ultimoControllo: Date | null;
  prezzi: PrezzoInCorso[];
}

export type Azione =
  | "prima_volta"
  | "conferma"
  | "invariata_prezzo_mancante"
  | "cambiata"
  | "pdf_cambiato"
  | "errore"
  | "link_rotto"
  | "non_controllabile"
  | "vietata_da_robots"
  | "saltata";

export interface EsitoFonte {
  sourceId: number;
  url: string;
  azione: Azione;
  dettaglio?: string;
  mancanti?: string[];
  tolte?: string[];
  aggiunte?: string[];
}

export interface Riepilogo {
  prova: boolean;
  fonti: number;
  conteggi: Partial<Record<Azione, number>>;
  esiti: EsitoFonte[];
}

/** Fonti da controllare: quelle dei prezzi dell'edizione in corso di ogni distanza. Le aggiunge se mancano. */
async function allineaFonti(client: PoolClient): Promise<void> {
  await client.query(`
    insert into sources (race_id, url, formato)
    select distinct d.race_id, p.fonte_url,
           case when lower(split_part(p.fonte_url, '?', 1)) like '%.pdf' then 'pdf' else 'pagina' end
    from prices p
    join distances d on d.id = p.distance_id
    where p.fonte_url ~ '^https?://'
      and p.edizione = (select max(edizione) from prices q where q.distance_id = p.distance_id)
    on conflict (race_id, url) do nothing`);
}

async function leggiFonti(client: PoolClient): Promise<Fonte[]> {
  const { rows } = await client.query(`
    select s.id, s.race_id, s.url, s.testo_utile, s.ultimo_hash, s.errori_consecutivi, s.ultimo_controllo,
           coalesce(json_agg(json_build_object('id', p.id, 'distanceId', p.distance_id, 'prezzo', p.prezzo,
             'valuta', p.valuta, 'edizione', p.edizione)) filter (where p.id is not null), '[]') as prezzi
    from sources s
    left join distances d on d.race_id = s.race_id
    left join prices p on p.distance_id = d.id and p.fonte_url = s.url
      and p.edizione = (select max(edizione) from prices q where q.distance_id = p.distance_id)
    group by s.id
    order by s.id`);
  return rows.map((r) => ({
    id: Number(r.id),
    raceId: r.race_id,
    url: r.url,
    testoUtile: r.testo_utile,
    ultimoHash: r.ultimo_hash,
    errori: r.errori_consecutivi,
    ultimoControllo: r.ultimo_controllo,
    prezzi: (r.prezzi as PrezzoInCorso[]).map((p) => ({ ...p, id: Number(p.id), prezzo: Number(p.prezzo), edizione: Number(p.edizione) })),
  }));
}

const descriviPrezzo = (p: PrezzoInCorso) => `${p.distanceId}: ${p.prezzo} ${p.valuta} (${p.edizione})`;

/** Decide cosa fare con una fonte, dato ciò che si è scaricato. Pura: la usano la notte e i test. */
export function valuta(fonte: Fonte, esito: EsitoScarico): EsitoFonte & { righe?: string[]; impronta?: string } {
  const base = { sourceId: fonte.id, url: fonte.url };
  if (esito.stato !== "ok") {
    if (esito.stato !== "errore") return { ...base, azione: esito.stato, dettaglio: esito.dettaglio };
    const azione = fonte.errori + 1 >= NOTTI_PRIMA_DI_LINK_ROTTO ? "link_rotto" : "errore";
    return { ...base, azione, dettaglio: esito.dettaglio };
  }
  if (esito.formato === "pdf") {
    if (!fonte.ultimoHash) return { ...base, azione: "prima_volta", impronta: esito.impronta };
    if (fonte.ultimoHash === esito.impronta) return { ...base, azione: "saltata", dettaglio: "PDF invariato", impronta: esito.impronta };
    return { ...base, azione: "pdf_cambiato", impronta: esito.impronta };
  }

  const mancanti = fonte.prezzi.filter((p) => !prezzoPresente(esito.testo, p.prezzo, p.valuta)).map(descriviPrezzo);
  const righe = esito.righe;
  if (fonte.testoUtile === null) {
    return { ...base, azione: "prima_volta", mancanti, righe, impronta: esito.impronta };
  }
  if (fonte.ultimoHash === esito.impronta) {
    if (mancanti.length) return { ...base, azione: "invariata_prezzo_mancante", mancanti, righe, impronta: esito.impronta };
    if (!fonte.prezzi.length) return { ...base, azione: "saltata", dettaglio: "nessun prezzo in corso", righe, impronta: esito.impronta };
    return { ...base, azione: "conferma", righe, impronta: esito.impronta };
  }
  const { tolte, aggiunte } = confrontaRighe(fonte.testoUtile.split("\n").filter(Boolean), righe);
  return { ...base, azione: "cambiata", mancanti, tolte, aggiunte, righe, impronta: esito.impronta };
}

function testoVoce(e: EsitoFonte): string {
  const parti: string[] = [];
  if (e.azione === "pdf_cambiato") parti.push("Il PDF è cambiato: va riletto.");
  if (e.azione === "cambiata") parti.push("La pagina è cambiata nelle righe su prezzi, iscrizioni o distanze.");
  if (e.mancanti?.length) parti.push(`Prezzi non trovati sulla pagina, da riverificare:\n${e.mancanti.map((m) => `• ${m}`).join("\n")}`);
  if (e.tolte?.length) parti.push(`Righe tolte:\n${e.tolte.map((r) => `− ${r}`).join("\n")}`);
  if (e.aggiunte?.length) parti.push(`Righe aggiunte:\n${e.aggiunte.map((r) => `+ ${r}`).join("\n")}`);
  if (e.azione === "link_rotto") parti.push(`La fonte non risponde da ${NOTTI_PRIMA_DI_LINK_ROTTO} notti: ${e.dettaglio}.`);
  return parti.join("\n\n");
}

/** Voce in coda: una sola aperta per fonte e tipo; se c'è già, si aggiorna. */
async function voceInCoda(client: PoolClient, fonte: Fonte, e: EsitoFonte): Promise<void> {
  const origine = e.azione === "link_rotto" ? "link_rotto" : "cambio_fonte";
  const proposta = {
    tipo: e.azione,
    url: fonte.url,
    distanze: [...new Set(fonte.prezzi.map((p) => p.distanceId))],
    mancanti: e.mancanti ?? [],
    tolte: e.tolte ?? [],
    aggiunte: e.aggiunte ?? [],
  };
  await client.query(
    `insert into review_queue (origine, race_id, source_id, diff_testo, proposta)
     values ($1, $2, $3, $4, $5)
     on conflict (source_id, origine) where stato = 'aperta' and origine in ('cambio_fonte', 'link_rotto')
     do update set diff_testo = excluded.diff_testo, proposta = excluded.proposta`,
    [origine, fonte.raceId, fonte.id, testoVoce(e), proposta],
  );
}

async function registra(
  client: PoolClient,
  fonte: Fonte,
  e: ReturnType<typeof valuta>,
  opzioni: OpzioniNotte,
): Promise<void> {
  const errore = e.azione === "errore" || e.azione === "link_rotto";
  const esitoFonte =
    e.azione === "conferma" || e.azione === "invariata_prezzo_mancante" || (e.azione === "saltata" && e.impronta)
      ? "invariata"
      : e.azione === "cambiata" || e.azione === "pdf_cambiato"
        ? "cambiata"
        : e.azione === "link_rotto"
          ? "errore"
          : e.azione;
  await client.query(
    `update sources set ultimo_controllo = now(), esito = $2,
       errori_consecutivi = case when $3 then errori_consecutivi + 1 else 0 end,
       errore = $4,
       ultimo_hash = coalesce($5, ultimo_hash),
       testo_utile = coalesce($6, testo_utile),
       ultimo_cambiamento = case when $7 then now() else ultimo_cambiamento end
     where id = $1`,
    [fonte.id, esitoFonte, errore, errore || esitoFonte === "non_controllabile" || esitoFonte === "vietata_da_robots" ? (e.dettaglio ?? null) : null,
      e.impronta ?? null, e.righe ? e.righe.join("\n") : null, esitoFonte === "cambiata"],
  );
  if (opzioni.prova) return;

  if (e.azione === "conferma") {
    await client.query(`update prices set confermato_il = $2 where id = any($1::bigint[])`, [fonte.prezzi.map((p) => p.id), opzioni.oggi]);
    await client.query(`update sources set ultima_conferma = now() where id = $1`, [fonte.id]);
  }
  const daSegnalare =
    e.azione === "cambiata" ||
    e.azione === "pdf_cambiato" ||
    e.azione === "link_rotto" ||
    e.azione === "invariata_prezzo_mancante" ||
    (e.azione === "prima_volta" && (e.mancanti?.length ?? 0) > 0);
  if (daSegnalare) await voceInCoda(client, fonte, e);
}

async function aGruppi<T>(elementi: T[], quanti: number, lavoro: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(quanti, elementi.length) }, async () => {
      while (i < elementi.length) await lavoro(elementi[i++]);
    }),
  );
}

const attesa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Una notte di controllo. Restituisce `null` se un'altra notte è già in corso. */
export async function eseguiNotte(db: Pool, opzioni: OpzioniNotte): Promise<Riepilogo | null> {
  const client = await db.connect();
  try {
    const { rows: lock } = await client.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [LOCK]);
    if (!lock[0].ok) return null;
    try {
      const { rows } = await client.query<{ id: string }>(
        "insert into controlli_notturni (prova) values ($1) returning id",
        [opzioni.prova],
      );
      const notte = rows[0].id;
      await allineaFonti(client);
      const fonti = await leggiFonti(client);

      const robots = new Robots(fetch);
      const scarica: Scarica = opzioni.scarica ?? ((url) => scaricaFonte(url, fetch, robots));
      const pausa = opzioni.pausaMs ?? PAUSA_TRA_PAGINE_MS;
      const esiti: EsitoFonte[] = [];
      const scaricati = new Map<string, Promise<EsitoScarico>>();
      const limite = Date.now() - ORE_TRA_CONTROLLI * 3_600_000;

      // Un sito alla volta per sito, qualche sito in parallelo; ogni indirizzo si scarica una volta sola.
      const perSito = new Map<string, Fonte[]>();
      for (const f of fonti) {
        const host = new URL(f.url).hostname.replace(/^www\./, "");
        perSito.set(host, [...(perSito.get(host) ?? []), f]);
      }
      await aGruppi([...perSito.values()], SITI_IN_PARALLELO, async (gruppo) => {
        for (const fonte of gruppo) {
          if (fonte.ultimoControllo && fonte.ultimoControllo.getTime() > limite) {
            esiti.push({ sourceId: fonte.id, url: fonte.url, azione: "saltata", dettaglio: "già controllata di recente" });
            continue;
          }
          let scarico = scaricati.get(fonte.url);
          if (!scarico) {
            scarico = scarica(fonte.url);
            scaricati.set(fonte.url, scarico);
            await scarico;
            if (pausa) await attesa(pausa);
          }
          const e = valuta(fonte, await scarico);
          // Ogni fonte nella sua transazione: un errore su una non ferma le altre.
          const c = await db.connect();
          try {
            await c.query("begin");
            await registra(c, fonte, e, opzioni);
            await c.query("commit");
          } catch (errore) {
            await c.query("rollback");
            e.azione = "errore";
            e.dettaglio = `errore interno: ${(errore as Error).message}`;
          } finally {
            c.release();
          }
          // Nel riepilogo non servono le righe intere né l'impronta.
          esiti.push({
            sourceId: e.sourceId, url: e.url, azione: e.azione, dettaglio: e.dettaglio,
            mancanti: e.mancanti, tolte: e.tolte, aggiunte: e.aggiunte,
          });
        }
      });

      const conteggi: Partial<Record<Azione, number>> = {};
      for (const e of esiti) conteggi[e.azione] = (conteggi[e.azione] ?? 0) + 1;
      const riepilogo: Riepilogo = { prova: opzioni.prova, fonti: fonti.length, conteggi, esiti };
      await client.query("update controlli_notturni set finito_il = now(), riepilogo = $2 where id = $1", [notte, riepilogo]);
      return riepilogo;
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}
