import { elencoFonti, ultimeNotti } from "@/lib/admin/fonti";
import { richiediRedattore } from "@/lib/admin/redattore";
import { pool } from "@/lib/db";
import styles from "../admin.module.css";
import { Navigazione } from "../navigazione";
import { t, type ChiaveAdmin } from "../testi";
import { annulla } from "./azioni";

export const dynamic = "force-dynamic";

const dataOra = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" });
const quando = (iso: string | null) => (iso ? dataOra.format(new Date(iso)) : t("fonti.mai"));

export default async function Fonti({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await richiediRedattore();
  const db = pool();
  const [fonti, notti, query] = await Promise.all([elencoFonti(db), ultimeNotti(db), searchParams]);

  return (
    <main className={styles.pagina}>
      <Navigazione />
      <h1>{t("fonti.titolo")}</h1>
      <p>{t("fonti.spiegazione")}</p>
      {query.esito === "annullate" && <p className={styles.avviso}>{t("fonti.annullate")}</p>}

      <section>
        <h2>{t("fonti.notti")}</h2>
        {notti.length === 0 ? (
          <p>{t("fonti.notti.vuoto")}</p>
        ) : (
          <div className={styles.contenitoreTabella}>
            <table className={styles.tabella}>
              <thead>
                <tr>
                  <th scope="col">{t("fonti.colonna.notte")}</th>
                  <th scope="col">{t("fonti.colonna.modalita")}</th>
                  <th scope="col">{t("fonti.colonna.conteggi")}</th>
                </tr>
              </thead>
              <tbody>
                {notti.map((n) => (
                  <tr key={n.id}>
                    <td>{quando(n.iniziatoIl)}</td>
                    <td>{n.prova ? t("fonti.notti.prova") : t("fonti.notti.attivo")}</td>
                    <td className={styles.dettaglio}>
                      {Object.entries(n.conteggi)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ") || t("voce.vuoto")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>
          {t("fonti.titolo")} <span className={styles.piccolo}>{fonti.length}</span>
        </h2>
        <div className={styles.contenitoreTabella}>
          <table className={styles.tabella}>
            <thead>
              <tr>
                <th scope="col">{t("fonti.colonna.fonte")}</th>
                <th scope="col">{t("fonti.colonna.esito")}</th>
                <th scope="col">{t("fonti.colonna.controllo")}</th>
                <th scope="col">{t("fonti.colonna.conferma")}</th>
                <th scope="col">{t("fonti.colonna.prezzi")}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {fonti.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.gara}
                    <br />
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className={styles.piccolo}>
                      {f.url}
                    </a>
                  </td>
                  <td>
                    {f.esito ? t(`esito_fonte.${f.esito}` as ChiaveAdmin) : t("voce.vuoto")}
                    {f.formato === "pdf" && " · PDF"}
                    {f.errore && (
                      <>
                        <br />
                        <span className={styles.piccolo}>{f.errore}</span>
                      </>
                    )}
                  </td>
                  <td>{quando(f.ultimoControllo)}</td>
                  <td>{quando(f.ultimaConferma)}</td>
                  <td>
                    {f.confermati}/{f.prezzi}
                  </td>
                  <td>
                    {f.confermati > 0 && (
                      <form action={annulla}>
                        <input type="hidden" name="sourceId" value={f.id} />
                        <button type="submit" className={styles.piccolo}>
                          {t("fonti.annulla")}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
