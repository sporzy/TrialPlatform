// Scheda di una voce del controllo notturno ("cambio_fonte", "link_rotto"): cosa è cambiato, dove correggere, come chiudere.

import Link from "next/link";
import type { VoceFonte } from "@/lib/admin/fonti";
import styles from "../../admin.module.css";
import { t } from "../../testi";
import { chiudiFonte } from "./azioni";

const dataOra = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });

export function VoceFonteVista({ voce }: { voce: VoceFonte }) {
  const aperta = voce.stato === "aperta";
  return (
    <>
      <h1>
        {t(`fonte.titolo.${voce.origine}`)}
        {voce.gara && ` · ${voce.gara}`}
      </h1>
      {voce.url && (
        <p>
          <a href={voce.url} target="_blank" rel="noopener noreferrer">
            {t("fonte.apri")}
          </a>{" "}
          <span className={styles.piccolo}>{voce.url}</span>
        </p>
      )}
      {!aperta && (
        <p className={styles.avviso}>
          {t("fonte.chiusa", {
            stato: t(`stato.${voce.stato as "approvata" | "scartata"}`),
            data: voce.chiusoIl ? dataOra.format(new Date(voce.chiusoIl)) : t("voce.vuoto"),
            chi: voce.chiusoDa ?? t("voce.vuoto"),
          })}
        </p>
      )}
      {voce.testo && <pre className={styles.differenze}>{voce.testo}</pre>}
      {voce.distanze.length > 0 && (
        <>
          <p>{t("fonte.distanze")}</p>
          <ul>
            {voce.distanze.map((d) => (
              <li key={d}>
                <Link href={`/admin/gare/${d}/`}>{d}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {aperta && (
        <form action={chiudiFonte} className={styles.pulsanti}>
          <input type="hidden" name="id" value={voce.id} />
          {voce.origine === "cambio_fonte" && (
            <button type="submit" name="come" value="riverificata" className={styles.primario}>
              {t("fonte.riverificata")}
            </button>
          )}
          <button type="submit" name="come" value="fatta">
            {t("fonte.fatta")}
          </button>
          <button type="submit" name="come" value="ignorata">
            {t("fonte.ignorata")}
          </button>
        </form>
      )}
      {aperta && voce.origine === "cambio_fonte" && <p className={styles.piccolo}>{t("fonte.riverificata.spiega")}</p>}
    </>
  );
}
