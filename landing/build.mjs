// Genera dist/ (una pagina per lingua) da pagina.html e testi/<lingua>.json.
// dist/ è generata: non modificarla a mano. Si rigenera con `node landing/build.mjs`
// (wrangler deploy la lancia da solo).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LINGUE, PREDEFINITA, percorso } from "./lingue.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const SITO = "https://fairkm.com";
const NOMI = { it: "Italiano", en: "English", fr: "Français", de: "Deutsch", es: "Español" };

export function leggiTesti() {
  return Object.fromEntries(
    LINGUE.map((l) => [l, JSON.parse(readFileSync(join(QUI, "testi", `${l}.json`), "utf8"))]),
  );
}

// Ogni lingua deve avere esattamente le stesse chiavi dell'italiano: niente pagine a metà.
export function controllaTesti(testi) {
  const attese = Object.keys(testi[PREDEFINITA]).sort();
  const errori = [];
  for (const lingua of LINGUE) {
    const chiavi = Object.keys(testi[lingua] ?? {});
    for (const c of attese) if (!chiavi.includes(c)) errori.push(`${lingua}.json: manca "${c}"`);
    for (const c of chiavi) if (!attese.includes(c)) errori.push(`${lingua}.json: "${c}" non esiste in ${PREDEFINITA}.json`);
    for (const c of chiavi) if (!String(testi[lingua][c]).trim()) errori.push(`${lingua}.json: "${c}" è vuota`);
  }
  if (errori.length) throw new Error(`Traduzioni incomplete:\n${errori.join("\n")}`);
}

function alternate() {
  const righe = LINGUE.map((l) => `  <link rel="alternate" hreflang="${l}" href="${SITO}${percorso(l)}">`);
  righe.push(`  <link rel="alternate" hreflang="x-default" href="${SITO}/">`);
  return righe.join("\n");
}

function selettore(attuale) {
  const voci = LINGUE.map((l) => {
    const corrente = l === attuale ? ' aria-current="page"' : "";
    return `        <li><a href="/?lang=${l}" hreflang="${l}" lang="${l}" title="${NOMI[l]}"${corrente}>${l.toUpperCase()}</a></li>`;
  });
  return `      <ul class="lingue">\n${voci.join("\n")}\n      </ul>`;
}

export function componi(modello, testi, lingua) {
  const valori = {
    ...testi,
    lingua,
    url: `${SITO}${percorso(lingua)}`,
    home: percorso(lingua),
    alternate: alternate(),
    selettore: selettore(lingua),
  };
  return modello.replace(/\{\{([\w.]+)\}\}/g, (_, chiave) => {
    if (!(chiave in valori)) throw new Error(`${lingua}: segnaposto {{${chiave}}} senza testo`);
    return valori[chiave];
  });
}

export function genera() {
  const modello = readFileSync(join(QUI, "pagina.html"), "utf8");
  const testi = leggiTesti();
  controllaTesti(testi);

  const dist = join(QUI, "dist");
  rmSync(dist, { recursive: true, force: true });
  cpSync(join(QUI, "public"), dist, { recursive: true });
  for (const lingua of LINGUE) {
    const cartella = join(dist, percorso(lingua));
    mkdirSync(cartella, { recursive: true });
    writeFileSync(join(cartella, "index.html"), componi(modello, testi[lingua], lingua));
  }
  return dist;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = genera();
  console.log(`Generate ${LINGUE.length} lingue in ${dist}`);
}
