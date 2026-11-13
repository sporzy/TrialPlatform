import { notFound } from "next/navigation";
import { erroriPubblicazione, oggiInItalia, type Campo } from "@/lib/admin/proposte";
import { richiediRedattore } from "@/lib/admin/redattore";
import { leggiVoce } from "@/lib/admin/scritture";
import { pool } from "@/lib/db";
import { EDIZIONE_MINIMA, PAESI } from "@/lib/regole";
import { CATEGORIE, SCAGLIONI } from "@/lib/tipi";
import styles from "../../admin.module.css";
import { t, type ChiaveAdmin } from "../../testi";
import { approva, salva, scartaVoce } from "./azioni";

export const dynamic = "force-dynamic";

const data = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });

type Tipo = "testo" | "numero" | "data" | "url" | "lungo" | { scelte: readonly string[] };
const SI_NO = { scelte: ["", "si", "no"] } as const;

const SEZIONI: [ChiaveAdmin, [Campo, Tipo][]][] = [
  ["voce.sezione.gara", [["evento", "testo"], ["paese", { scelte: PAESI }], ["zona", "testo"], ["categoria", { scelte: CATEGORIE }]]],
  ["voce.sezione.distanza", [["distanza", "testo"], ["km", "numero"], ["dplus", "numero"], ["riferimento_nazionale", { scelte: ["no", "si"] }], ["note", "lungo"]]],
  ["voce.sezione.prezzo", [
    ["edizione", "numero"], ["prezzo", "numero"], ["valuta", "testo"], ["scaglione", { scelte: SCAGLIONI }],
    ["include_iva", SI_NO], ["include_commissioni", SI_NO], ["prezzo_precedente", "numero"], ["edizione_precedente", "numero"],
  ]],
  ["voce.sezione.fonti", [
    ["fonte_url", "url"], ["fonte_tipo", "testo"], ["data_verifica", "data"], ["altre_fonti_url", "url"],
    ["fonte_storico_url", "url"], ["fonte_prezzo_precedente_url", "url"],
  ]],
];

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
  if (!voce || voce.origine !== "nuova_gara") notFound();

  const query = await searchParams;
  const esito = ESITI.find((e) => e === query.esito);
  const erroriAzione = typeof query.errori === "string" ? query.errori.split("\n").filter(Boolean) : [];
  const aperta = voce.stato === "aperta";
  const errori = aperta ? [...new Set([...erroriAzione, ...erroriPubblicazione(voce.riga, oggiInItalia())])] : [];

  return (
    <main className={styles.pagina}>
      <p>
        <a href="/admin/">{t("voce.indietro")}</a>
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
        <fieldset disabled={!aperta} className={styles.campi}>
          {SEZIONI.map(([titolo, campi]) => (
            <section key={titolo} className={styles.sezione}>
              <h2>{t(titolo)}</h2>
              <div className={styles.griglia}>
                {campi.map(([campo, tipo]) => (
                  <label key={campo} className={tipo === "lungo" || tipo === "url" ? styles.largo : undefined}>
                    <span>{t(`campo.${campo}`)}</span>
                    <Controllo campo={campo} tipo={tipo} valore={voce.riga[campo]} />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </fieldset>
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

function Controllo({ campo, tipo, valore }: { campo: Campo; tipo: Tipo; valore: string }) {
  if (typeof tipo === "object") {
    // Un valore salvato che non è tra le scelte resta visibile (e la validazione lo segnala).
    const scelte = tipo.scelte.includes(valore) ? tipo.scelte : [...tipo.scelte, valore];
    return (
      <select name={campo} defaultValue={valore}>
        {scelte.map((s) => (
          <option key={s} value={s}>
            {s === "" ? t("voce.vuoto") : s === "si" ? t("voce.si") : s === "no" ? t("voce.no") : s}
          </option>
        ))}
      </select>
    );
  }
  if (tipo === "lungo") return <textarea name={campo} defaultValue={valore} rows={4} />;
  const type = tipo === "data" ? "date" : tipo === "url" ? "url" : "text";
  return (
    <input
      name={campo}
      type={type}
      defaultValue={valore}
      inputMode={tipo === "numero" ? "decimal" : undefined}
      autoComplete="off"
    />
  );
}
