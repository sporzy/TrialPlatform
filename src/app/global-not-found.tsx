// 404 di tutto il sito. Next lo serve senza layout né parametri, quindi non sa in che lingua siamo:
// il messaggio compare in tutte le lingue, ognuna con il link alla sua pagina.

import type { Metadata } from "next";
import { percorsoGare, RIFERIMENTO } from "../../landing/lingue.mjs";
import { TESTI, traduttore, type Lingua } from "@/lib/testi";
import "./globals.css";
import styles from "./[lingua]/races/page.module.css";

const LINGUE = Object.keys(TESTI) as Lingua[];

export const metadata: Metadata = {
  title: `${traduttore(RIFERIMENTO as Lingua).t("nonTrovata.titolo")} · ${traduttore(RIFERIMENTO as Lingua).t("meta.titolo")}`,
};

export default function NonTrovata() {
  return (
    <html lang={RIFERIMENTO}>
      <body>
        <main className={styles.pagina}>
          {LINGUE.map((lingua, i) => {
            const { t } = traduttore(lingua);
            // Un solo titolo principale: il primo (inglese).
            const Titolo = i === 0 ? "h1" : "h2";
            return (
              <section key={lingua} lang={lingua} className={styles.intestazione}>
                <Titolo>{t("nonTrovata.titolo")}</Titolo>
                <p>
                  {t("nonTrovata.testo")} <a href={percorsoGare(lingua)}>{t("nonTrovata.link")}</a>
                </p>
              </section>
            );
          })}
        </main>
      </body>
    </html>
  );
}
