import { contaDati, leggiCodaAperta } from "@/lib/admin/coda";
import { richiediRedattore } from "@/lib/admin/redattore";
import { pool } from "@/lib/db";
import styles from "./admin.module.css";
import { t } from "./testi";

export const dynamic = "force-dynamic";

const data = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" });

const ESITI = ["approvata", "scartata"] as const;

export default async function Redazione({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const redattore = await richiediRedattore();
  const query = await searchParams;
  const esito = ESITI.find((e) => e === query.esito);
  const db = pool();
  const [coda, conteggi] = await Promise.all([leggiCodaAperta(db), contaDati(db)]);

  return (
    <main className={styles.pagina}>
      <header className={styles.intestazione}>
        <h1>{t("titolo")}</h1>
        <p>{t("sottotitolo")}</p>
        <p className={styles.piccolo}>
          {t("entrato", { email: redattore.email })} · <a href="/races/">{t("sito")}</a>
        </p>
      </header>

      {esito && <p className={styles.avviso}>{t(`esito.${esito}`)}</p>}

      <section>
        <h2>{t("dati.titolo")}</h2>
        <p>{t("dati.conteggi", { gare: conteggi.gare, distanze: conteggi.distanze, prezzi: conteggi.prezzi })}</p>
      </section>

      <section>
        <h2>
          {t("coda.titolo")} <span className={styles.piccolo}>{t("coda.aperte", { n: coda.length })}</span>
        </h2>
        {coda.length === 0 ? (
          <p>{t("coda.vuota")}</p>
        ) : (
          <div className={styles.contenitoreTabella}>
            <table className={styles.tabella}>
              <thead>
                <tr>
                  <th scope="col">{t("coda.colonna.voce")}</th>
                  <th scope="col">{t("coda.colonna.origine")}</th>
                  <th scope="col">{t("coda.colonna.motivo")}</th>
                  <th scope="col">{t("coda.colonna.data")}</th>
                </tr>
              </thead>
              <tbody>
                {coda.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.origine === "nuova_gara" ? <a href={`/admin/coda/${v.id}/`}>{v.titolo}</a> : v.titolo}
                    </td>
                    <td>{t(`origine.${v.origine}`)}</td>
                    <td>{v.motivo}</td>
                    <td>{data.format(new Date(v.creatoIl))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
