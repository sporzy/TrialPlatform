// Testi dell'interfaccia nelle 5 lingue (CLAUDE.md: nessun testo scritto nei componenti).
// I testi si scrivono prima in inglese (src/testi/en.json); le altre lingue devono avere le stesse chiavi,
// non vuote e con gli stessi segnaposto {{nome}}. Se no il modulo non si carica e la build si ferma.

import { createElement, Fragment, type ReactNode } from "react";
import de from "@/testi/de.json";
import en from "@/testi/en.json";
import es from "@/testi/es.json";
import fr from "@/testi/fr.json";
import it from "@/testi/it.json";
import { RIFERIMENTO } from "../../landing/lingue.mjs";

export type Chiave = keyof typeof en;
type Testi = Record<Chiave, string>;

// Stesse lingue della landing (landing/lingue.mjs, verificato nei test).
export const TESTI = { en, it, fr, de, es } satisfies Record<string, Testi>;

export type Lingua = keyof typeof TESTI;

export function eLingua(valore: string): valore is Lingua {
  return Object.hasOwn(TESTI, valore);
}

// Formati di numeri e valute per lingua. L'inglese segue le convenzioni britanniche (km, €/£ davanti).
export const LOCALE: Record<Lingua, string> = {
  en: "en-GB",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
};

const SEGNAPOSTO = /\{\{(\w+)\}\}/g;

function segnaposti(testo: string): string[] {
  return [...new Set([...testo.matchAll(SEGNAPOSTO)].map((m) => m[1]))].sort();
}

/** Errori di traduzione rispetto alla lingua di riferimento; vuoto se tutto torna. */
export function controllaTesti(testi: Record<string, Record<string, unknown>>, riferimento: string): string[] {
  const base = testi[riferimento];
  const attese = Object.keys(base);
  const errori: string[] = [];
  for (const [lingua, voci] of Object.entries(testi)) {
    for (const c of attese) if (!(c in voci)) errori.push(`${lingua}.json: manca "${c}"`);
    for (const [c, testo] of Object.entries(voci)) {
      if (!(c in base)) errori.push(`${lingua}.json: "${c}" non esiste in ${riferimento}.json`);
      else if (typeof testo !== "string" || !testo.trim()) errori.push(`${lingua}.json: "${c}" è vuota`);
      else if (segnaposti(testo).join() !== segnaposti(String(base[c])).join()) {
        errori.push(`${lingua}.json: "${c}" ha segnaposti diversi da ${riferimento}.json`);
      }
    }
  }
  return errori;
}

const errori = controllaTesti(TESTI, RIFERIMENTO);
if (errori.length) throw new Error(`Traduzioni incomplete:\n${errori.join("\n")}`);

type Valori = Record<string, string | number>;

export interface Traduttore {
  lingua: Lingua;
  locale: string;
  /** Testo con i segnaposto {{nome}} sostituiti. */
  t(chiave: Chiave, valori?: Valori): string;
  /** Come t, ma i segnaposto possono essere elementi (es. un badge dentro una frase). */
  tRicco(chiave: Chiave, valori: Record<string, ReactNode>): ReactNode;
  /** Forma singolare o plurale: usa le chiavi `<base>.uno` e `<base>.altri`, con {{n}}. */
  tNumero(base: ChiaveNumero, n: number, nFormattato: string): string;
}

type ChiaveNumero = Chiave extends infer C ? (C extends `${infer B}.uno` ? B : never) : never;

export function traduttore(lingua: Lingua): Traduttore {
  const testi: Testi = TESTI[lingua];
  const locale = LOCALE[lingua];
  const plurali = new Intl.PluralRules(locale);

  const t = (chiave: Chiave, valori: Valori = {}) =>
    testi[chiave].replace(SEGNAPOSTO, (intero, nome: string) => (nome in valori ? String(valori[nome]) : intero));

  return {
    lingua,
    locale,
    t,
    tRicco(chiave, valori) {
      const parti = testi[chiave].split(SEGNAPOSTO);
      // split con un gruppo: le posizioni dispari sono i nomi dei segnaposto.
      return parti.map((parte, i) => createElement(Fragment, { key: i }, i % 2 ? (valori[parte] ?? `{{${parte}}}`) : parte));
    },
    tNumero(base, n, nFormattato) {
      const forma = plurali.select(n) === "one" ? "uno" : "altri";
      return t(`${base}.${forma}` as Chiave, { n: nFormattato });
    },
  };
}
