import { rigaVuota } from "@/lib/admin/proposte";
import { richiediRedattore } from "@/lib/admin/redattore";
import styles from "../admin.module.css";
import { CampiRiga } from "../campi-riga";
import { Navigazione } from "../navigazione";
import { t } from "../testi";
import { mettiInCoda } from "./azioni";

export const dynamic = "force-dynamic";

export default async function NuovaGara() {
  await richiediRedattore();
  const riga = { ...rigaVuota(), paese: "IT", categoria: "piccola", riferimento_nazionale: "no", scaglione: "standard", valuta: "EUR" };
  return (
    <main className={styles.pagina}>
      <Navigazione />
      <h1>{t("nuova.titolo")}</h1>
      <p>{t("nuova.spiegazione")}</p>
      <form action={mettiInCoda} className={styles.modulo}>
        <CampiRiga riga={riga} />
        <section className={styles.sezione}>
          <div className={styles.griglia}>
            <label className={styles.largo}>
              <span>{t("nuova.motivo.etichetta")}</span>
              <input name="motivo" type="text" defaultValue={t("nuova.motivo")} autoComplete="off" />
            </label>
          </div>
        </section>
        <div className={styles.pulsanti}>
          <button type="submit" className={styles.primario}>
            {t("nuova.invia")}
          </button>
        </div>
      </form>
    </main>
  );
}
