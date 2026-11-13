import Link from "next/link";
import { notFound } from "next/navigation";
import { leggiScheda, prezzoVuoto, type PrezzoModulo } from "@/lib/admin/modifiche";
import { richiediRedattore } from "@/lib/admin/redattore";
import { pool } from "@/lib/db";
import { CATEGORIE, SCAGLIONI } from "@/lib/tipi";
import styles from "../../admin.module.css";
import { Navigazione } from "../../navigazione";
import { t, type ChiaveAdmin } from "../../testi";
import { salvaCorrezioni } from "./azioni";

export const dynamic = "force-dynamic";

type Scelte = readonly string[];
const SI_NO: Scelte = ["", "si", "no"];

export default async function ModificaDistanza({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await richiediRedattore();
  const { id } = await params;
  if (!/^[a-z0-9-]+$/.test(id)) notFound();
  const scheda = await leggiScheda(pool(), id);
  if (!scheda) notFound();
  const query = await searchParams;
  const errori = typeof query.errori === "string" ? query.errori.split("\n").filter(Boolean) : [];
  const { gara, distanza, prezzi } = scheda.modulo;
  const valuta = prezzi[0]?.valuta ?? "";

  return (
    <main className={styles.pagina}>
      <Navigazione />
      <p>
        <Link href="/admin/gare/">{t("modifica.indietro")}</Link>
      </p>
      <h1>{t("modifica.titolo", { gara: gara.nome, distanza: distanza.nome })}</h1>
      {query.esito === "salvata" && <p className={styles.avviso}>{t("modifica.salvata")}</p>}
      {query.esito === "non_salvata" && (
        <div className={styles.errore}>
          <p>{t("modifica.non_salvata")}</p>
          <ul>
            {errori.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form action={salvaCorrezioni} className={styles.modulo}>
        <input type="hidden" name="distanceId" value={scheda.distanceId} />

        <section className={styles.sezione}>
          <h2>{t("modifica.sezione.gara")}</h2>
          <p className={styles.piccolo}>{t("modifica.condivisa")}</p>
          <div className={styles.griglia}>
            <Campo nome="gara.nome" etichetta="modifica.campo.nome" valore={gara.nome} />
            <Campo nome="gara.regione" etichetta="modifica.campo.regione" valore={gara.regione} />
            <Campo nome="gara.categoria" etichetta="modifica.campo.categoria" valore={gara.categoria} scelte={CATEGORIE} />
            <Campo nome="gara.qualifica_utmb" etichetta="modifica.campo.qualifica_utmb" valore={gara.qualifica_utmb} scelte={SI_NO} />
            <Campo nome="gara.organizzatore" etichetta="modifica.campo.organizzatore" valore={gara.organizzatore} />
            <Campo nome="gara.sito" etichetta="modifica.campo.sito" valore={gara.sito} largo />
            <Campo nome="gara.fonte_storico_url" etichetta="modifica.campo.fonte_storico_url" valore={gara.fonte_storico_url} largo />
          </div>
        </section>

        <section className={styles.sezione}>
          <h2>{t("modifica.sezione.distanza")}</h2>
          <div className={styles.griglia}>
            <Campo nome="distanza.nome" etichetta="modifica.campo.nome" valore={distanza.nome} />
            <Campo nome="distanza.km" etichetta="modifica.campo.km" valore={distanza.km} />
            <Campo nome="distanza.dplus" etichetta="modifica.campo.dplus" valore={distanza.dplus} />
            <Campo
              nome="distanza.riferimento_nazionale"
              etichetta="modifica.campo.riferimento_nazionale"
              valore={distanza.riferimento_nazionale}
              scelte={["no", "si"]}
            />
            <Campo nome="distanza.altre_fonti_url" etichetta="modifica.campo.altre_fonti_url" valore={distanza.altre_fonti_url} lungo />
            <Campo nome="distanza.note" etichetta="modifica.campo.note" valore={distanza.note} lungo />
          </div>
        </section>

        <section className={styles.sezione}>
          <h2>{t("modifica.sezione.prezzi")}</h2>
          {prezzi.map((p) => (
            <Prezzo key={p.id} prezzo={p} chiave={String(p.id)} />
          ))}
          <p className={styles.piccolo}>{t("modifica.prezzo.nuovo")}</p>
          <Prezzo prezzo={prezzoVuoto(valuta)} chiave="nuovo" />
        </section>

        <div className={styles.pulsanti}>
          <button type="submit" className={styles.primario}>
            {t("modifica.salva")}
          </button>
        </div>
      </form>
    </main>
  );
}

function Prezzo({ prezzo, chiave }: { prezzo: PrezzoModulo; chiave: string }) {
  const n = (c: string) => `prezzo.${chiave}.${c}`;
  return (
    <fieldset className={styles.prezzo}>
      <div className={styles.griglia}>
        <Campo nome={n("edizione")} etichetta="modifica.campo.edizione" valore={prezzo.edizione} />
        <Campo nome={n("scaglione")} etichetta="modifica.campo.scaglione" valore={prezzo.scaglione} scelte={SCAGLIONI} />
        <Campo nome={n("ordine")} etichetta="modifica.campo.ordine" valore={prezzo.ordine} />
        <Campo nome={n("prezzo")} etichetta="modifica.campo.prezzo" valore={prezzo.prezzo} />
        <Campo nome={n("valuta")} etichetta="modifica.campo.valuta" valore={prezzo.valuta} />
        <Campo nome={n("include_iva")} etichetta="modifica.campo.include_iva" valore={prezzo.include_iva} scelte={SI_NO} />
        <Campo
          nome={n("include_commissioni")}
          etichetta="modifica.campo.include_commissioni"
          valore={prezzo.include_commissioni}
          scelte={SI_NO}
        />
        <Campo nome={n("data_rilevazione")} etichetta="modifica.campo.data_rilevazione" valore={prezzo.data_rilevazione} tipo="date" />
        <Campo nome={n("fonte_url")} etichetta="modifica.campo.fonte_url" valore={prezzo.fonte_url} largo />
        <Campo nome={n("fonte_tipo")} etichetta="modifica.campo.fonte_tipo" valore={prezzo.fonte_tipo} largo />
        {chiave !== "nuovo" && (
          <label className={styles.casella}>
            <input type="checkbox" name={n("elimina")} />
            <span>{t("modifica.campo.elimina")}</span>
          </label>
        )}
      </div>
    </fieldset>
  );
}

function Campo({
  nome,
  etichetta,
  valore,
  scelte,
  largo = false,
  lungo = false,
  tipo = "text",
}: {
  nome: string;
  etichetta: ChiaveAdmin;
  valore: string;
  scelte?: Scelte;
  largo?: boolean;
  lungo?: boolean;
  tipo?: string;
}) {
  const opzioni = scelte && !scelte.includes(valore) ? [...scelte, valore] : scelte;
  return (
    <label className={largo || lungo ? styles.largo : undefined}>
      <span>{t(etichetta)}</span>
      {opzioni ? (
        <select name={nome} defaultValue={valore}>
          {opzioni.map((s) => (
            <option key={s} value={s}>
              {s === "" ? t("voce.vuoto") : s === "si" ? t("voce.si") : s === "no" ? t("voce.no") : s}
            </option>
          ))}
        </select>
      ) : lungo ? (
        <textarea name={nome} defaultValue={valore} rows={3} />
      ) : (
        <input name={nome} type={tipo} defaultValue={valore} autoComplete="off" />
      )}
    </label>
  );
}
