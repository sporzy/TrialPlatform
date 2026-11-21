import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { CARTELLA_GARE, percorso, percorsoGare } from "../../../../landing/lingue.mjs";
import { caricaDati } from "@/lib/dati";
import { costruisciElenco, type RigaElenco } from "@/lib/elenco";
import {
  FASCE,
  filtraElenco,
  filtriAttivi,
  LUNGHEZZE,
  leggiFiltri,
  ORDINI,
  parametriFiltri,
  type Filtri,
  type Lunghezza,
  type Risultato,
  type SchedaGara,
} from "@/lib/filtri";
import { formato, type Formato } from "@/lib/formato";
import { kmSforzo, type Fascia } from "@/lib/metriche";
import { SOGLIE } from "@/lib/soglie";
import { eLingua, TESTI, traduttore, type Chiave, type Lingua, type Traduttore } from "@/lib/testi";
import { Logo } from "../logo";
import { MiglioreFiltri } from "./migliorie";
import styles from "./page.module.css";

const CLASSI_FASCE: Record<Fascia, string> = {
  giusto: styles.verde,
  sopra_soglia: styles.giallo,
  grandi_circuiti: styles.rosso,
  categoria_a_parte: styles.grigio,
};

interface Contesto {
  tr: Traduttore;
  f: Formato;
}


export default async function Elenco({ params, searchParams }: PageProps<"/[lingua]/races">) {
  const { lingua } = await params;
  if (!eLingua(lingua)) notFound();
  const tr = traduttore(lingua);
  const f = formato(tr.locale);
  const { t } = tr;
  // I dati si leggono a ogni visita, non alla build: su Render la build non raggiunge il database,
  // e un cambiamento approvato deve vedersi subito, senza un nuovo deploy.
  await connection();
  const sezioni = costruisciElenco(await caricaDati());
  const filtri = leggiFiltri(await searchParams, sezioni.map((s) => s.paese));
  const risultato = filtraElenco(sezioni, filtri);
  const query = parametriFiltri(filtri).toString();
  const tutte = sezioni.reduce((n, s) => n + s.righe.length, 0);

  return (
    <>
      <Testata lingua={lingua} query={query} tr={tr} />
      <main className={styles.pagina}>
        <header className={styles.intestazione}>
          <h1>{t("elenco.titolo")}</h1>
          <p>{tr.tNumero("elenco.intro", tutte, f.numero(tutte))}</p>
        </header>

        <ModuloFiltri filtri={filtri} risultato={risultato} tr={tr} f={f} />

        <p className={styles.conteggio} role="status">
          {tr.tNumero("risultati.gare", risultato.gare, f.numero(risultato.gare))} ·{" "}
          {tr.tNumero("sezione.conteggio", risultato.distanze, f.numero(risultato.distanze))}
          {filtriAttivi(filtri) && (
            <>
              {" · "}
              <a href="?">{t("filtri.togli")}</a>
            </>
          )}
        </p>

        <Legenda tr={tr} f={f} />

        {risultato.sezioni.length === 0 && <p className={styles.vuoto}>{t("risultati.vuoto")}</p>}

        {risultato.sezioni.map((sezione) => {
          const paese = t(`paese.${sezione.paese}` as Chiave);
          const distanze = sezione.gare.reduce((n, g) => n + g.righe.length, 0);
          return (
            <section key={sezione.paese} className={styles.sezione} aria-labelledby={`paese-${sezione.paese}`}>
              <h2 id={`paese-${sezione.paese}`}>
                {paese}{" "}
                <span className={styles.conteggioSezione}>
                  {tr.tNumero("risultati.gare", sezione.gare.length, f.numero(sezione.gare.length))} ·{" "}
                  {tr.tNumero("sezione.conteggio", distanze, f.numero(distanze))}
                </span>
              </h2>
              <ol className={styles.griglia}>
                {sezione.gare.map((g) => (
                  <li key={g.raceId}>
                    <Scheda gara={g} tr={tr} f={f} />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </main>
      <MiglioreFiltri id="filtri" classeJs={styles.conJs} />
    </>
  );
}

// Come la testata della landing: logo, navigazione e lingue. Il cambio lingua conserva i filtri.
function Testata({ lingua, query, tr }: { lingua: Lingua; query: string; tr: Traduttore }) {
  const { t } = tr;
  const landing = percorso(lingua);
  return (
    <header className={styles.testata}>
      <a className={styles.marchio} href={landing} aria-label={t("marchio.aria")}>
        <Logo />
      </a>
      <nav className={styles.navigazione} aria-label={t("nav.etichetta")}>
        <a href={percorsoGare(lingua)} aria-current="page">
          {t("nav.gare")}
        </a>
        <a href={`${landing}#metodo`}>{t("nav.metodo")}</a>
      </nav>
      <nav className={styles.lingue} aria-label={t("lingue.etichetta")}>
        {(Object.keys(TESTI) as Lingua[]).map((l) => (
          <a
            key={l}
            href={`/${CARTELLA_GARE}/?lang=${l}${query ? `&${query}` : ""}`}
            hrefLang={l}
            lang={l}
            title={traduttore(l).t("lingua.nome")}
            aria-current={l === lingua ? "page" : undefined}
          >
            {l.toUpperCase()}
          </a>
        ))}
      </nav>
    </header>
  );
}

function ModuloFiltri({ filtri, risultato, tr, f }: { filtri: Filtri; risultato: Risultato } & Contesto) {
  const { t } = tr;
  const { conteggi } = risultato;
  const etichettaLunghezza = (l: Lunghezza) =>
    l === "corta"
      ? t("lunghezza.corta", { km: f.numero(SOGLIE.kmGaraLunga) })
      : l === "media"
        ? t("lunghezza.media", { da: f.numero(SOGLIE.kmGaraLunga), a: f.numero(SOGLIE.kmUltra) })
        : t("lunghezza.lunga", { km: f.numero(SOGLIE.kmUltra) });
  const paesi = Object.keys(conteggi.paese);
  const attivi = (filtri.paese ? 1 : 0) + filtri.lunghezze.length + filtri.fasce.length + (filtri.ordine !== "costo" ? 1 : 0);

  return (
    <form id="filtri" className={styles.filtri} method="get" role="search" aria-label={t("filtri.etichetta")}>
      <label className={styles.cerca}>
        <span>{t("filtri.cerca")}</span>
        <input type="search" name="q" defaultValue={filtri.q} placeholder={t("filtri.cerca.segnaposto")} maxLength={80} />
      </label>

      <details className={styles.altriFiltri} open={attivi > 0}>
        <summary>
          {t("filtri.altri")}
          {attivi > 0 && <span className={styles.numero}> · {f.numero(attivi)}</span>}
        </summary>
        <div className={styles.gruppi}>
      <fieldset className={styles.gruppo}>
        <legend>{t("filtri.paese")}</legend>
        <Scelta tipo="radio" nome="paese" valore="" attiva={!filtri.paese}>
          {t("filtri.tutti")}
        </Scelta>
        {paesi.map((p) => (
          <Scelta key={p} tipo="radio" nome="paese" valore={p} attiva={filtri.paese === p} numero={f.numero(conteggi.paese[p])}>
            {t(`paese.${p}` as Chiave)}
          </Scelta>
        ))}
      </fieldset>

      <fieldset className={styles.gruppo}>
        <legend>{t("filtri.lunghezza")}</legend>
        {LUNGHEZZE.filter((l) => conteggi.lunghezza[l] > 0).map((l) => (
          <Scelta key={l} tipo="checkbox" nome="lunghezza" valore={l} attiva={filtri.lunghezze.includes(l)} numero={f.numero(conteggi.lunghezza[l])}>
            {etichettaLunghezza(l)}
          </Scelta>
        ))}
      </fieldset>

      <fieldset className={styles.gruppo}>
        <legend>{t("colonna.fascia")}</legend>
        {/* Le fasce senza distanze (oggi "categoria a parte") non si mostrano: darebbero sempre zero risultati. */}
        {FASCE.filter((x) => conteggi.fascia[x] > 0).map((x) => (
          <Scelta key={x} tipo="checkbox" nome="fascia" valore={x} attiva={filtri.fasce.includes(x)} numero={f.numero(conteggi.fascia[x])} classe={CLASSI_FASCE[x]}>
            {t(`fascia.${x}`)}
          </Scelta>
        ))}
      </fieldset>

      <label className={styles.ordine}>
        <span>{t("filtri.ordine")}</span>
        <select name="ordine" defaultValue={filtri.ordine}>
          {ORDINI.map((o) => (
            <option key={o} value={o}>
              {t(`ordine.${o}`)}
            </option>
          ))}
        </select>
      </label>

        </div>
      </details>

      <button type="submit" className={styles.applica}>
        {t("filtri.applica")}
      </button>
    </form>
  );
}

function Scelta({
  tipo,
  nome,
  valore,
  attiva,
  numero,
  classe,
  children,
}: {
  tipo: "radio" | "checkbox";
  nome: string;
  valore: string;
  attiva: boolean;
  numero?: string;
  classe?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.scelta}>
      <input type={tipo} name={nome} value={valore} defaultChecked={attiva} />
      <span className={styles.pillola}>
        {classe && <span className={`${styles.pallino} ${classe}`} aria-hidden="true" />}
        {children}
        {numero && <span className={styles.numero}>{numero}</span>}
      </span>
    </label>
  );
}

function Scheda({ gara, tr, f }: { gara: SchedaGara } & Contesto) {
  const { t } = tr;
  return (
    <article className={styles.scheda} id={gara.raceId} aria-labelledby={`gara-${gara.raceId}`}>
      <header className={styles.testaScheda}>
        <h3 id={`gara-${gara.raceId}`}>{gara.gara}</h3>
        {(gara.regione || gara.sito) && (
          <p className={styles.luogo}>
            {gara.regione}
            {gara.regione && gara.sito && " · "}
            {gara.sito && (
              <a href={gara.sito} target="_blank" rel="noopener noreferrer">
                {t("scheda.sito")}
              </a>
            )}
          </p>
        )}
      </header>
      <ul className={styles.distanze}>
        {gara.righe.map((riga) => (
          <li key={riga.distanceId}>
            <Distanza riga={riga} tr={tr} f={f} />
          </li>
        ))}
      </ul>
      {gara.nascoste > 0 && (
        <p className={styles.altre}>
          <a href={`?${new URLSearchParams({ q: gara.gara })}`}>{tr.tNumero("scheda.altre", gara.nascoste, f.numero(gara.nascoste))}</a>
        </p>
      )}
    </article>
  );
}

function Distanza({ riga, tr, f }: { riga: RigaElenco } & Contesto) {
  const { t } = tr;
  const { prezzo } = riga;
  return (
    <div className={styles.distanza}>
      <div className={styles.nomeDistanza}>
        {/* Una distanza con lo stesso nome della gara non lo ripete: il titolo della scheda basta. */}
        {riga.distanza && <strong>{riga.distanza}</strong>}
        {riga.riferimentoNazionale && <Badge classe={styles.grigio}>{t("riga.riferimento")}</Badge>}
        <span className={styles.misure}>
          {f.km(riga.km)} km · {f.numero(riga.dplus)} m D+ · {f.numero(riga.kmSforzo, 1)} {t("colonna.kmSforzo")}
        </span>
      </div>

      <div className={styles.costoBlocco}>
        {riga.costoKmSforzo === null ? (
          <span className={styles.secondario}>{t("fascia.senzaStandard")}</span>
        ) : (
          <>
            <span className={styles.costo}>
              {f.valuta(riga.costoKmSforzo, prezzo.valuta, 2)} <small>{t("riga.perKmSforzo")}</small>
            </span>
            {riga.fascia && <Badge classe={CLASSI_FASCE[riga.fascia]}>{t(`fascia.${riga.fascia}`)}</Badge>}
          </>
        )}
      </div>

      <p className={styles.dettagli}>
        <span className={styles.prezzo}>{f.valuta(prezzo.prezzo, prezzo.valuta, prezzo.prezzo % 1 ? 2 : 0)}</span> · {prezzo.edizione}
        {prezzo.scaglione !== "standard" && ` · ${t(`scaglione.${prezzo.scaglione}`)}`}
        {riga.riferimentoNazionale ? (
          <> · {t("indice.riferimento")}</>
        ) : (
          riga.confronto && (
            <>
              {" · "}
              <strong>{f.percentuale(riga.confronto.indice)}</strong> {t("indice.vs", { riferimento: riga.confronto.riferimento })}
            </>
          )
        )}
        <Aumento riga={riga} tr={tr} f={f} />
      </p>

      {/* CLAUDE.md: accanto a ogni prezzo la data di verifica e "fa fede il sito ufficiale". */}
      <p className={styles.fonte}>
        {prezzo.dataRilevazione && `${t("prezzo.verificato", { data: f.data(prezzo.dataRilevazione) })} · `}
        {/* Conferma del controllo notturno (CLAUDE.md, "Controllo notturno"): separata dalla verifica di una persona. */}
        {prezzo.confermatoIl &&
          (!prezzo.dataRilevazione || prezzo.confermatoIl > prezzo.dataRilevazione) &&
          `${t("prezzo.ricontrollato", { data: f.data(prezzo.confermatoIl) })} · `}
        {prezzo.fonteUrl ? (
          <a href={prezzo.fonteUrl} target="_blank" rel="noopener noreferrer">
            {t("prezzo.fonte")}
          </a>
        ) : (
          t("prezzo.fonteDaVerificare")
        )}
        {" · "}
        {t("prezzo.faFede")}
      </p>
    </div>
  );
}

function Aumento({ riga, tr, f }: { riga: RigaElenco } & Contesto) {
  const { t } = tr;
  const { aumento } = riga;
  if (!aumento) return null;
  if (aumento.tipo === "non_confrontabile") {
    return <> · {t("aumento.nonConfrontabile", { motivo: t(`aumento.motivo.${aumento.motivo}`) })}</>;
  }
  return (
    <>
      {" · "}
      {t("colonna.aumento")}{" "}
      {riga.badgeAumento === "rosso" ? (
        <Badge classe={styles.rosso}>{f.percentuale(aumento.valore)}</Badge>
      ) : (
        f.percentuale(aumento.valore)
      )}
      {aumento.tipo === "percorso_modificato" && ` (${t("aumento.percorsoModificato")})`}
    </>
  );
}

function Badge({ classe, children }: { classe: string; children: ReactNode }) {
  return <span className={`${styles.badge} ${classe}`}>{children}</span>;
}

function Legenda({ tr, f }: Contesto) {
  const { t } = tr;
  const v = (n: number) => f.numero(n, 2);
  return (
    <details className={styles.legenda}>
      <summary>{t("legenda.titolo")}</summary>
      <dl>
        <dt>{t("colonna.kmSforzo")}</dt>
        <dd>
          {t("legenda.kmSforzo", { km: f.numero(50), dplus: f.numero(3000), kmSforzo: f.numero(kmSforzo(50, 3000)) })}
        </dd>
        <dt>{t("colonna.costo")}</dt>
        <dd>{t("legenda.costo")}</dd>
        <dt>{t("colonna.indice")}</dt>
        <dd>{t("legenda.indice")}</dd>
        <dt>{t("colonna.fascia")}</dt>
        <dd>
          {tr.tRicco("legenda.fascia", {
            giusto: <Badge classe={styles.verde}>{t("fascia.giusto")}</Badge>,
            sopra: <Badge classe={styles.giallo}>{t("fascia.sopra_soglia")}</Badge>,
            circuiti: <Badge classe={styles.rosso}>{t("fascia.grandi_circuiti")}</Badge>,
            parte: <Badge classe={styles.grigio}>{t("fascia.categoria_a_parte")}</Badge>,
            sogliaLunga: v(SOGLIE.costoGiustoGaraLunga),
            sogliaCorta: v(SOGLIE.costoGiustoGaraCorta),
            kmLunga: f.numero(SOGLIE.kmGaraLunga),
            limite: v(SOGLIE.limiteGrandiCircuiti),
          })}
        </dd>
        <dt>{t("colonna.aumento")}</dt>
        <dd>{t("legenda.aumento", { soglia: f.percentuale(SOGLIE.aumentoRosso) })}</dd>
        <dt>{t("legenda.standard.titolo")}</dt>
        <dd>{t("legenda.standard")}</dd>
      </dl>
    </details>
  );
}
