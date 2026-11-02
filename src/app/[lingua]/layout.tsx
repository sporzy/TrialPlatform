import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
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
