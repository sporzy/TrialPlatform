import { caricaDati } from "@/lib/dati";
import { costruisciElenco, type RigaElenco } from "@/lib/elenco";
import { formatKm, formatNumero, formatPercentuale, formatValuta } from "@/lib/formato";
import type { Fascia } from "@/lib/metriche";
import { SOGLIE } from "@/lib/soglie";
import styles from "./page.module.css";

const FASCE: Record<Fascia, { etichetta: string; classe: string }> = {
  giusto: { etichetta: "Costa il giusto", classe: styles.verde },
  sopra_soglia: { etichetta: "Sopra soglia", classe: styles.giallo },
  grandi_circuiti: { etichetta: "Grandi circuiti", classe: styles.rosso },
  categoria_a_parte: { etichetta: "Categoria a parte", classe: styles.grigio },
};

const MOTIVI_NON_CONFRONTABILE = {
  valuta: "valuta diversa",
  scaglione: "scaglione diverso",
  base: "IVA o commissioni diverse",
};

export default async function Home() {
  const sezioni = costruisciElenco(await caricaDati());

  return (
    <main className={styles.pagina}>
      <header className={styles.intestazione}>
        <h1>Gare trail che costano il giusto</h1>
        <p>
          Prezzo, sforzo e confronto con i grandi circuiti per {sezioni.reduce((n, s) => n + s.righe.length, 0)}{" "}
          distanze in Italia e nel Regno Unito. Prezzi sempre nella valuta locale, mai convertiti.
        </p>
      </header>

      <Legenda />

      {sezioni.map((sezione) => (
        <section key={sezione.paese} className={styles.sezione} aria-labelledby={`paese-${sezione.paese}`}>
          <h2 id={`paese-${sezione.paese}`}>
            {sezione.nomePaese} <span className={styles.conteggio}>{sezione.righe.length} distanze</span>
          </h2>
          <div className={styles.contenitoreTabella} tabIndex={0} role="region" aria-label={`Gare in ${sezione.nomePaese}`}>
            <table className={styles.tabella}>
              <thead>
                <tr>
                  <th scope="col">Gara</th>
                  <th scope="col" className={styles.num}>km</th>
                  <th scope="col" className={styles.num}>D+</th>
                  <th scope="col" className={styles.num}>Prezzo</th>
                  <th scope="col" className={styles.num}>km-sforzo</th>
                  <th scope="col" className={styles.num}>Costo / km-sforzo</th>
                  <th scope="col">Indice vs riferimento</th>
                  <th scope="col">Fascia</th>
                  <th scope="col">Aumento a/a</th>
                </tr>
              </thead>
              <tbody>
                {sezione.righe.map((riga) => (
                  <Riga key={riga.distanceId} riga={riga} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}

function Riga({ riga }: { riga: RigaElenco }) {
  const { prezzo } = riga;
  const fascia = riga.fascia ? FASCE[riga.fascia] : null;
  return (
    <tr>
      <th scope="row" className={styles.gara}>
        <span className={styles.nomeGara}>{riga.gara}</span>
        {riga.distanza && <> <span className={styles.nomeDistanza}>{riga.distanza}</span></>}
        {riga.riferimentoNazionale && <> <span className={styles.etichetta}>riferimento</span></>}
        {riga.regione && <span className={styles.secondario}>{riga.regione}</span>}
      </th>
      <td className={styles.num}>{formatKm(riga.km)}</td>
      <td className={styles.num}>{formatNumero(riga.dplus)}</td>
      <td className={styles.num}>
        {formatValuta(prezzo.prezzo, prezzo.valuta)}
        <span className={styles.secondario}>
          {prezzo.edizione}
          {prezzo.scaglione !== "standard" && ` · ${prezzo.scaglione}`}
          {prezzo.fonteUrl ? (
            <>
              {" · "}
              <a href={prezzo.fonteUrl} target="_blank" rel="noopener noreferrer">
                fonte
              </a>
            </>
          ) : (
            " · fonte da verificare"
          )}
        </span>
      </td>
      <td className={styles.num}>{formatNumero(riga.kmSforzo, 1)}</td>
      <td className={`${styles.num} ${styles.costo}`}>
        {riga.costoKmSforzo === null ? "—" : formatNumero(riga.costoKmSforzo, 2)}
      </td>
      <td>
        {riga.riferimentoNazionale ? (
          <span className={styles.secondario}>è il riferimento</span>
        ) : riga.confronto ? (
          <>
            {formatPercentuale(riga.confronto.indice)}
            <span className={styles.secondario}>vs {riga.confronto.riferimento}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td>
        {fascia ? (
          <span className={`${styles.badge} ${fascia.classe}`}>{fascia.etichetta}</span>
        ) : (
          <span className={styles.secondario}>manca il prezzo standard</span>
        )}
      </td>
      <td>
        <Aumento riga={riga} />
      </td>
    </tr>
  );
}

function Aumento({ riga }: { riga: RigaElenco }) {
  const { aumento } = riga;
  if (!aumento) return <span className={styles.secondario}>—</span>;
  if (aumento.tipo === "non_confrontabile") {
    return <span className={styles.secondario}>non confrontabile ({MOTIVI_NON_CONFRONTABILE[aumento.motivo]})</span>;
  }
  return (
    <>
      {riga.badgeAumento === "rosso" ? (
        <span className={`${styles.badge} ${styles.rosso}`}>{formatPercentuale(aumento.valore)}</span>
      ) : (
        formatPercentuale(aumento.valore)
      )}
      {aumento.tipo === "percorso_modificato" && <span className={styles.secondario}>percorso modificato</span>}
    </>
  );
}

function Legenda() {
  const v = (n: number) => formatNumero(n, 2);
  return (
    <details className={styles.legenda}>
      <summary>Come leggere la tabella</summary>
      <dl>
        <dt>km-sforzo</dt>
        <dd>km + D+ / 100. Es. 50 km con 3.000 m D+ = 80 km-sforzo.</dd>
        <dt>Costo / km-sforzo</dt>
        <dd>Prezzo / km-sforzo, nella valuta locale della gara.</dd>
        <dt>Indice vs riferimento</dt>
        <dd>
          Quanto costa in più o in meno, per km-sforzo, rispetto alla distanza di riferimento più simile dello stesso paese
          (Italia: Lavaredo 20K, 50K, 80K, 120K; Regno Unito: UTS 50K, 100M).
        </dd>
        <dt>Fascia</dt>
        <dd>
          <span className={`${styles.badge} ${styles.verde}`}>Costa il giusto</span> fino a {v(SOGLIE.costoGiustoGaraLunga)}{" "}
          per gare da {SOGLIE.kmGaraLunga} km in su, fino a {v(SOGLIE.costoGiustoGaraCorta)} sotto i {SOGLIE.kmGaraLunga} km.{" "}
          <span className={`${styles.badge} ${styles.giallo}`}>Sopra soglia</span> fino a {v(SOGLIE.limiteGrandiCircuiti)}.{" "}
          <span className={`${styles.badge} ${styles.rosso}`}>Grandi circuiti</span> oltre {v(SOGLIE.limiteGrandiCircuiti)}.{" "}
          <span className={`${styles.badge} ${styles.grigio}`}>Categoria a parte</span> per fell race e gare di club.
          Soglie provvisorie, uguali in ogni valuta.
        </dd>
        <dt>Aumento a/a</dt>
        <dd>
          Rispetto all&apos;edizione precedente, stesso scaglione e stessa base; in rosso oltre +
          {formatNumero(SOGLIE.aumentoRosso * 100)}%.
        </dd>
        <dt>Prezzo standard</dt>
        <dd>
          Costo, fascia, indice e aumento usano sempre lo scaglione standard. Se una gara pubblica solo un altro
          scaglione (es. early), il prezzo si mostra con il suo scaglione ma senza metriche.
        </dd>
      </dl>
    </details>
  );
}
