import Link from "next/link";
import { notFound } from "next/navigation";
import { erroriPubblicazione, oggiInItalia } from "@/lib/admin/proposte";
import { leggiVoceFonte } from "@/lib/admin/fonti";
import { richiediRedattore } from "@/lib/admin/redattore";
import { leggiVoce } from "@/lib/admin/scritture";
import { pool } from "@/lib/db";
import { EDIZIONE_MINIMA } from "@/lib/regole";
import styles from "../../admin.module.css";
import { CampiRiga } from "../../campi-riga";
import { Navigazione } from "../../navigazione";
import { VoceFonteVista } from "./voce-fonte";
import { t } from "../../testi";
import { approva, salva, scartaVoce } from "./azioni";

export const dynamic = "force-dynamic";

const data = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });

const ESITI = ["salvata", "non_approvata"] as const;

export default async function Voce({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await richiediRedattore();
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();
  const voce = await leggiVoce(pool(), numero);
  if (!voce) notFound();
  if (voce.origine === "cambio_fonte" || voce.origine === "link_rotto") {
    const fonte = await leggiVoceFonte(pool(), numero);
    if (!fonte) notFound();
    return (
      <main className={styles.pagina}>
        <Navigazione />
        <VoceFonteVista voce={fonte} />
      </main>
    );
  }
  if (voce.origine !== "nuova_gara") notFound();

  const query = await searchParams;
  const esito = ESITI.find((e) => e === query.esito);
  const erroriAzione = typeof query.errori === "string" ? query.errori.split("\n").filter(Boolean) : [];
  const aperta = voce.stato === "aperta";
  const errori = aperta ? [...new Set([...erroriAzione, ...erroriPubblicazione(voce.riga, oggiInItalia())])] : [];

  return (
    <main className={styles.pagina}>
      <Navigazione />
      <p>
        <Link href="/admin/">{t("voce.indietro")}</Link>
      </p>
      <h1>
        {t("voce.titolo", { id: voce.id })} · {[voce.riga.evento, voce.riga.distanza].filter(Boolean).join(" · ")}
      </h1>
      {voce.motivo && (
        <p>
          <strong>{t("voce.motivo")}:</strong> {voce.motivo}
        </p>
      )}

      {esito && <p className={esito === "salvata" ? styles.avviso : styles.errore}>{t(`esito.${esito}`)}</p>}
      {query.esistente && <p className={styles.avviso}>{t("nuova.esisteva")}</p>}

      {!aperta && (
        <p className={styles.avviso}>
          {t("voce.chiusa", {
            stato: voce.stato,
            data: voce.chiusoIl ? data.format(new Date(voce.chiusoIl)) : t("voce.vuoto"),
            chi: voce.chiusoDa ?? t("voce.vuoto"),
          })}
        </p>
      )}

      {aperta && (
        <div className={errori.length ? styles.errore : styles.avviso}>
          {errori.length ? (
            <>
              <p>{t("voce.mancano")}</p>
              <ul>
                {errori.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t("voce.pronta")}</p>
          )}
          <p className={styles.piccolo}>{t("voce.regole", { edizione: EDIZIONE_MINIMA })}</p>
        </div>
      )}

      <form className={styles.modulo}>
        <input type="hidden" name="id" value={voce.id} />
        <CampiRiga riga={voce.riga} disabilitati={!aperta} />
        {aperta && (
          <div className={styles.pulsanti}>
            <button type="submit" formAction={salva}>
              {t("voce.salva")}
            </button>
            <button type="submit" formAction={approva} className={styles.primario}>
              {t("voce.approva")}
            </button>
          </div>
        )}
      </form>

      {aperta && (
        <details className={styles.scarta}>
          <summary>{t("voce.scarta.apri")}</summary>
          <form action={scartaVoce}>
            <input type="hidden" name="id" value={voce.id} />
            <button type="submit">{t("voce.scarta.conferma")}</button>
          </form>
        </details>
      )}
    </main>
  );
}
