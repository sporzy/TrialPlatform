import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { caricaDati } from "@/lib/dati";
import { costruisciElenco, type RigaElenco } from "@/lib/elenco";
import { formato, type Formato } from "@/lib/formato";
import { kmSforzo, type Fascia } from "@/lib/metriche";
import { SOGLIE } from "@/lib/soglie";
import { eLingua, traduttore, type Chiave, type Traduttore } from "@/lib/testi";
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

export default async function Elenco({ params }: PageProps<"/[lingua]">) {
  const { lingua } = await params;
  if (!eLingua(lingua)) notFound();
  const tr = traduttore(lingua);
  const f = formato(tr.locale);
  const { t } = tr;
  const sezioni = costruisciElenco(await caricaDati());
  const totale = sezioni.reduce((n, s) => n + s.righe.length, 0);

  return (
    <main className={styles.pagina}>
      <header className={styles.intestazione}>
        <h1>{t("elenco.titolo")}</h1>
        <p>{tr.tNumero("elenco.intro", totale, f.numero(totale))}</p>
      </header>

      <Legenda tr={tr} f={f} />

      {sezioni.map((sezione) => {
        const paese = t(`paese.${sezione.paese}` as Chiave);
        return (
          <section key={sezione.paese} className={styles.sezione} aria-labelledby={`paese-${sezione.paese}`}>
            <h2 id={`paese-${sezione.paese}`}>
              {paese}{" "}
              <span className={styles.conteggio}>
                {tr.tNumero("sezione.conteggio", sezione.righe.length, f.numero(sezione.righe.length))}
              </span>
            </h2>
            <div
              className={styles.contenitoreTabella}
              tabIndex={0}
              role="region"
              aria-label={t("sezione.regione", { paese })}
            >
              <table className={styles.tabella}>
                <thead>
                  <tr>
                    <th scope="col">{t("colonna.gara")}</th>
                    <th scope="col" className={styles.num}>{t("colonna.km")}</th>
                    <th scope="col" className={styles.num}>{t("colonna.dplus")}</th>
                    <th scope="col" className={styles.num}>{t("colonna.prezzo")}</th>
                    <th scope="col" className={styles.num}>{t("colonna.kmSforzo")}</th>
                    <th scope="col" className={styles.num}>{t("colonna.costo")}</th>
                    <th scope="col">{t("colonna.indice")}</th>
                    <th scope="col">{t("colonna.fascia")}</th>
                    <th scope="col">{t("colonna.aumento")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sezione.righe.map((riga) => (
                    <Riga key={riga.distanceId} riga={riga} tr={tr} f={f} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}

function Riga({ riga, tr, f }: { riga: RigaElenco } & Contesto) {
  const { t } = tr;
  const { prezzo } = riga;
  return (
    <tr>
      <th scope="row" className={styles.gara}>
        <span className={styles.nomeGara}>{riga.gara}</span>
        {riga.distanza && <> <span className={styles.nomeDistanza}>{riga.distanza}</span></>}
        {riga.riferimentoNazionale && <> <span className={styles.etichetta}>{t("riga.riferimento")}</span></>}
        {riga.regione && <span className={styles.secondario}>{riga.regione}</span>}
      </th>
      <td className={styles.num}>{f.km(riga.km)}</td>
      <td className={styles.num}>{f.numero(riga.dplus)}</td>
      <td className={`${styles.num} ${styles.cellaPrezzo}`}>
        {f.valuta(prezzo.prezzo, prezzo.valuta)}
        <span className={styles.secondario}>
          {prezzo.edizione}
          {prezzo.scaglione !== "standard" && ` · ${t(`scaglione.${prezzo.scaglione}`)}`}
        </span>
        {/* CLAUDE.md: accanto a ogni prezzo la data di verifica e "fa fede il sito ufficiale". */}
        <span className={styles.secondario}>
          {prezzo.dataRilevazione && `${t("prezzo.verificato", { data: f.data(prezzo.dataRilevazione) })} · `}
          {prezzo.fonteUrl ? (
            <a href={prezzo.fonteUrl} target="_blank" rel="noopener noreferrer">
              {t("prezzo.fonte")}
            </a>
          ) : (
            t("prezzo.fonteDaVerificare")
          )}
        </span>
        <span className={styles.secondario}>{t("prezzo.faFede")}</span>
      </td>
      <td className={styles.num}>{f.numero(riga.kmSforzo, 1)}</td>
      <td className={`${styles.num} ${styles.costo}`}>
        {riga.costoKmSforzo === null ? "—" : f.numero(riga.costoKmSforzo, 2)}
      </td>
      <td>
        {riga.riferimentoNazionale ? (
          <span className={styles.secondario}>{t("indice.riferimento")}</span>
        ) : riga.confronto ? (
          <>
            {f.percentuale(riga.confronto.indice)}
            <span className={styles.secondario}>{t("indice.vs", { riferimento: riga.confronto.riferimento })}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td>
        {riga.fascia ? (
          <Badge classe={CLASSI_FASCE[riga.fascia]}>{t(`fascia.${riga.fascia}`)}</Badge>
        ) : (
          <span className={styles.secondario}>{t("fascia.senzaStandard")}</span>
        )}
      </td>
      <td>
        <Aumento riga={riga} tr={tr} f={f} />
      </td>
    </tr>
  );
}

function Aumento({ riga, tr, f }: { riga: RigaElenco } & Contesto) {
  const { t } = tr;
  const { aumento } = riga;
  if (!aumento) return <span className={styles.secondario}>—</span>;
  if (aumento.tipo === "non_confrontabile") {
    return (
      <span className={styles.secondario}>
        {t("aumento.nonConfrontabile", { motivo: t(`aumento.motivo.${aumento.motivo}`) })}
      </span>
    );
  }
  return (
    <>
      {riga.badgeAumento === "rosso" ? (
        <Badge classe={styles.rosso}>{f.percentuale(aumento.valore)}</Badge>
      ) : (
        f.percentuale(aumento.valore)
      )}
      {aumento.tipo === "percorso_modificato" && (
        <span className={styles.secondario}>{t("aumento.percorsoModificato")}</span>
      )}
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
