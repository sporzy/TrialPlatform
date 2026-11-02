import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { percorso } from "../../../landing/lingue.mjs";
import { ANALYTICS_SRC, ANALYTICS_TOKEN, EMAIL, INSTAGRAM, SITO } from "../../../landing/sito.mjs";
import { eLingua, TESTI, traduttore, type Lingua } from "@/lib/testi";
import "../globals.css";
import styles from "./layout.module.css";

// Una pagina statica per lingua: l'inglese alla radice, le altre in /it/, /fr/, ... (src/proxy.ts).
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(TESTI).map((lingua) => ({ lingua }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lingua]">): Promise<Metadata> {
  const { lingua } = await params;
  if (!eLingua(lingua)) return {};
  const { t } = traduttore(lingua);
  return { title: t("meta.titolo"), description: t("meta.descrizione") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lingua]">) {
  const { lingua } = await params;
  if (!eLingua(lingua)) notFound();
  return (
    <html lang={lingua}>
      <body>
        <SelettoreLingua attuale={lingua} />
        {children}
        <Piede lingua={lingua} />
        {/* Statistiche senza cookie (CLAUDE.md), stesso sito della landing. */}
        <script defer src={ANALYTICS_SRC} data-cf-beacon={JSON.stringify({ token: ANALYTICS_TOKEN })} />
      </body>
    </html>
  );
}

// Come nella landing: /?lang=xx salva la scelta nel cookie tecnico della lingua e porta alla sua pagina.
function SelettoreLingua({ attuale }: { attuale: Lingua }) {
  const { t } = traduttore(attuale);
  return (
    <nav className={styles.lingue} aria-label={t("lingue.etichetta")}>
      <ul>
        {(Object.keys(TESTI) as Lingua[]).map((l) => (
          <li key={l}>
            <a
              href={`/?lang=${l}`}
              hrefLang={l}
              lang={l}
              title={traduttore(l).t("lingua.nome")}
              aria-current={l === attuale ? "page" : undefined}
            >
              {l.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Come il piede della landing, più quello che serve accanto ai dati: informativa, newsletter e segnalazione errori.
// Informativa e iscrizione stanno sulla landing (fairkm.com), nella stessa lingua.
function Piede({ lingua }: { lingua: Lingua }) {
  const { t, tRicco } = traduttore(lingua);
  const landing = `${SITO}${percorso(lingua)}`;
  return (
    <footer className={styles.piede}>
      <p>
        <a href={landing}>{t("meta.titolo")}</a> · {t("piede.descrizione")}
      </p>
      <p>{tRicco("piede.errore", { email: <a href={`mailto:${EMAIL}`}>{EMAIL}</a> })}</p>
      <ul>
        <li>
          <a href={`${landing}#iscrizione`}>{t("piede.newsletter")}</a>
        </li>
        <li>
          <a href={`${landing}privacy/`}>{t("piede.privacy")}</a>
        </li>
        <li>
          <a href={`https://www.instagram.com/${INSTAGRAM}/`} rel="me noopener" aria-label={t("piede.instagram")}>
            {`@${INSTAGRAM}`}
          </a>
        </li>
      </ul>
    </footer>
  );
}
