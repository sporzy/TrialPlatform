// Campi del modulo di una riga (gara, distanza, prezzo, fonti): li usano la scheda della coda e "nuova gara".

import type { Campo } from "@/lib/admin/proposte";
import type { RigaProposta } from "@/lib/importa-csv";
import { PAESI } from "@/lib/regole";
import { CATEGORIE, SCAGLIONI } from "@/lib/tipi";
import styles from "./admin.module.css";
import { t, type ChiaveAdmin } from "./testi";

type Tipo = "testo" | "numero" | "data" | "url" | "lungo" | { scelte: readonly string[] };
const SI_NO = { scelte: ["", "si", "no"] } as const;

export const SEZIONI: [ChiaveAdmin, [Campo, Tipo][]][] = [
  ["voce.sezione.gara", [["evento", "testo"], ["paese", { scelte: PAESI }], ["zona", "testo"], ["categoria", { scelte: CATEGORIE }], ["sito", "url"]]],
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


export function CampiRiga({ riga, disabilitati = false }: { riga: RigaProposta; disabilitati?: boolean }) {
  return (
    <fieldset disabled={disabilitati} className={styles.campi}>
      {SEZIONI.map(([titolo, campi]) => (
        <section key={titolo} className={styles.sezione}>
          <h2>{t(titolo)}</h2>
          <div className={styles.griglia}>
            {campi.map(([campo, tipo]) => (
              <label key={campo} className={tipo === "lungo" || tipo === "url" ? styles.largo : undefined}>
                <span>{t(`campo.${campo}`)}</span>
                <Controllo campo={campo} tipo={tipo} valore={riga[campo]} />
              </label>
            ))}
          </div>
        </section>
      ))}
    </fieldset>
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
