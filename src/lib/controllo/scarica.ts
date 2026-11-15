// Scarica una fonte con le buone maniere: robots.txt, un tempo massimo, una dimensione massima, rimandi seguiti
// uno per uno (e solo sullo stesso sito). Restituisce le righe utili (pagine) o l'impronta dei byte (PDF).
// `fetch` si passa da fuori: nei test non si va mai in rete.

import { createHash } from "node:crypto";
import { consentitoDaRobots, AGENTE, stessoSito, USER_AGENT } from "./rete";
import { righeUtili, testoDaHtml } from "./testo";

export type EsitoScarico =
  | { stato: "ok"; formato: "pagina"; righe: string[]; testo: string; impronta: string; urlFinale: string }
  | { stato: "ok"; formato: "pdf"; impronta: string; urlFinale: string }
  | { stato: "errore" | "non_controllabile" | "vietata_da_robots"; dettaglio: string };

type Fetch = typeof fetch;

const TEMPO_MASSIMO_MS = 20_000;
const BYTE_MASSIMI = 8 * 1024 * 1024;
const RIMANDI_MASSIMI = 5;

const impronta = (dati: string | Uint8Array) => createHash("sha256").update(dati).digest("hex");

async function leggiLimitato(risposta: Response): Promise<Uint8Array | null> {
  const lettore = risposta.body?.getReader();
  if (!lettore) return new Uint8Array();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > BYTE_MASSIMI) {
      await lettore.cancel();
      return null;
    }
    pezzi.push(value);
  }
  const tutto = new Uint8Array(totale);
  let pos = 0;
  for (const p of pezzi) {
    tutto.set(p, pos);
    pos += p.byteLength;
  }
  return tutto;
}

async function conTempo<T>(lavoro: (segnale: AbortSignal) => Promise<T>): Promise<T> {
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), TEMPO_MASSIMO_MS);
  try {
    return await lavoro(controllo.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Regole robots.txt per sito, scaricate una volta per notte. */
export class Robots {
  private cache = new Map<string, Promise<string | null>>();
  constructor(private readonly f: Fetch) {}

  /** `null` = robots.txt irraggiungibile per errore del sito (5xx o rete): per prudenza non si scarica. */
  private regole(origine: string): Promise<string | null> {
    let r = this.cache.get(origine);
    if (!r) {
      r = conTempo(async (signal) => {
        const risposta = await this.f(`${origine}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal });
        if (risposta.status >= 500) return null;
        if (!risposta.ok) return "";
        const corpo = await leggiLimitato(risposta);
        return corpo ? new TextDecoder().decode(corpo) : "";
      }).catch(() => null);
      this.cache.set(origine, r);
    }
    return r;
  }

  async consente(url: string): Promise<boolean | null> {
    const u = new URL(url);
    const regole = await this.regole(u.origin);
    if (regole === null) return null;
    return consentitoDaRobots(regole, AGENTE, u.pathname + u.search);
  }
}

export async function scaricaFonte(url: string, f: Fetch, robots: Robots): Promise<EsitoScarico> {
  let attuale = url;
  for (let salto = 0; salto <= RIMANDI_MASSIMI; salto++) {
    const permesso = await robots.consente(attuale);
    if (permesso === null) return { stato: "non_controllabile", dettaglio: "robots.txt non raggiungibile" };
    if (!permesso) return { stato: "vietata_da_robots", dettaglio: "il sito chiede ai programmi di non leggere questa pagina" };

    let risposta: Response;
    try {
      risposta = await conTempo((signal) =>
        f(attuale, {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" },
          redirect: "manual",
          signal,
        }),
      );
    } catch (e) {
      const nome = (e as Error).name;
      return { stato: "errore", dettaglio: nome === "AbortError" ? "tempo scaduto" : `rete: ${(e as Error).message}` };
    }

    if (risposta.status >= 300 && risposta.status < 400) {
      const dove = risposta.headers.get("location");
      if (!dove) return { stato: "errore", dettaglio: `rimando ${risposta.status} senza destinazione` };
      const prossimo = new URL(dove, attuale).toString();
      if (!stessoSito(url, prossimo)) return { stato: "errore", dettaglio: `rimanda a un altro sito: ${new URL(prossimo).hostname}` };
      attuale = prossimo;
      continue;
    }
    if ([401, 403, 429].includes(risposta.status)) {
      return { stato: "non_controllabile", dettaglio: `il sito non risponde ai programmi (${risposta.status})` };
    }
    if (!risposta.ok) return { stato: "errore", dettaglio: `il sito risponde ${risposta.status}` };

    const corpo = await leggiLimitato(risposta).catch(() => null);
    if (!corpo) return { stato: "errore", dettaglio: "risposta troppo grande o interrotta" };
    const tipo = risposta.headers.get("content-type") ?? "";
    const ePdf = tipo.includes("application/pdf") || new TextDecoder().decode(corpo.slice(0, 5)) === "%PDF-";
    if (ePdf) return { stato: "ok", formato: "pdf", impronta: impronta(corpo), urlFinale: attuale };

    const testo = testoDaHtml(new TextDecoder().decode(corpo));
    // Pagine di verifica anti-robot (es. "Just a moment..."): non sono la fonte.
    if (/just a moment|checking your browser|attention required|enable javascript and cookies/i.test(testo.slice(0, 500))) {
      return { stato: "non_controllabile", dettaglio: "pagina di verifica anti-robot" };
    }
    const righe = righeUtili(testo);
    return { stato: "ok", formato: "pagina", righe, testo, impronta: impronta(righe.join("\n")), urlFinale: attuale };
  }
  return { stato: "errore", dettaglio: "troppi rimandi" };
}
