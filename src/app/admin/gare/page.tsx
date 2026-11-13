import Link from "next/link";
import { elencoDistanze } from "@/lib/admin/modifiche";
import { richiediRedattore } from "@/lib/admin/redattore";
import { pool } from "@/lib/db";
import styles from "../admin.module.css";
import { Navigazione } from "../navigazione";
import { t } from "../testi";

export const dynamic = "force-dynamic";

export default async function GarePubblicate() {
  await richiediRedattore();
  const righe = await elencoDistanze(pool());
  return (
    <main className={styles.pagina}>
      <Navigazione />
      <h1>{t("gare.titolo")}</h1>
      <p>{t("gare.spiegazione")}</p>
      <div className={styles.contenitoreTabella}>
        <table className={styles.tabella}>
          <thead>
            <tr>
              <th scope="col">{t("gare.colonna.gara")}</th>
              <th scope="col">{t("gare.colonna.paese")}</th>
              <th scope="col">{t("gare.colonna.km")}</th>
              <th scope="col">{t("gare.colonna.dplus")}</th>
              <th scope="col">{t("gare.colonna.prezzo")}</th>
              <th scope="col">{t("gare.colonna.verificato")}</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.distanceId}>
                <td>
                  <Link href={`/admin/gare/${r.distanceId}/`}>
                    {r.gara} · {r.distanza}
                  </Link>
                </td>
                <td>{r.paese}</td>
                <td>{r.km}</td>
                <td>{r.dplus}</td>
                <td>{r.prezzo ?? t("voce.vuoto")}</td>
                <td>{r.verificato ?? t("voce.vuoto")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
