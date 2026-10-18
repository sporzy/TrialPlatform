// Genera dist/ (una pagina per lingua) da pagina.html e testi/<lingua>.json.
// dist/ è generata: non modificarla a mano. Si rigenera con `node landing/build.mjs`
// (wrangler deploy la lancia da solo).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CURVE } from "./curve.mjs";
import { leggiGare, valoriGare } from "./dati.mjs";
import { LINGUE, PREDEFINITA, percorso } from "./lingue.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const SITO = "https://fairkm.com";
// Il modulo d'iscrizione si mostra solo quando /api/iscrizione è collegato al servizio email.
export const ISCRIZIONE_ATTIVA = false;
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

// Ogni lingua deve avere la sua immagine di anteprima (generata da anteprime.mjs).
export function controllaAnteprime(cartella = join(QUI, "public", "og")) {
  const mancanti = LINGUE.filter((l) => !existsSync(join(cartella, `${l}.png`)));
  if (mancanti.length) {
    throw new Error(`Anteprime mancanti: ${mancanti.join(", ")}. Lancia \`node landing/anteprime.mjs\`.`);
  }
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

// Mappa del sito per i motori di ricerca: ogni lingua con i link alle altre.
export function sitemap() {
  const alternative = LINGUE.map(
    (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITO}${percorso(l)}"/>`,
  );
  alternative.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITO}/"/>`);
  const voci = LINGUE.map((l) => `  <url>\n    <loc>${SITO}${percorso(l)}</loc>\n${alternative.join("\n")}\n  </url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...voci,
    "</urlset>",
    "",
  ].join("\n");
}

// Valori calcolati dai dati (d.*), curve della carta e dati per lo script della pagina.
export function valoriCalcolati(testi, lingua, gare = leggiGare()) {
  const valori = { ...valoriGare(gare, lingua, testi), ...CURVE };
  const datiPagina = {
    fila: valori["d.fila.dati"],
    iscrizione: {
      ok: testi["iscrizione.ok"],
      errore: testi["iscrizione.errore"],
      email: testi["iscrizione.email"],
    },
  };
  delete valori["d.fila.dati"];
  valori["iscrizione.se_attiva"] = ISCRIZIONE_ATTIVA ? "" : " hidden";
  valori["iscrizione.se_chiusa"] = ISCRIZIONE_ATTIVA ? " hidden" : "";
  // Dentro <script type="application/json">: niente "<" letterali, così non si chiude il tag.
  valori["pagina.json"] = JSON.stringify(datiPagina).replace(/</g, "\\u003c");
  return valori;
}

// Testi e valori possono contenere a loro volta segnaposto (es. {{d.esempio.costo}} dentro un testo).
export function componi(modello, testi, lingua, calcolati = {}) {
  const valori = {
    ...calcolati,
    lingua,
    url: `${SITO}${percorso(lingua)}`,
    home: percorso(lingua),
    immagine: `${SITO}/og/${lingua}.png`,
    alternate: alternate(),
    selettore: selettore(lingua),
  };
  const sostituisci = (testo) =>
    testo.replace(/\{\{([\w.]+)\}\}/g, (_, chiave) => {
      if (chiave in testi) return sostituisci(testi[chiave]);
      if (!(chiave in valori)) throw new Error(`${lingua}: segnaposto {{${chiave}}} senza testo`);
      return sostituisci(valori[chiave]);
    });
  return sostituisci(modello);
}

export function genera() {
  const modello = readFileSync(join(QUI, "pagina.html"), "utf8");
  const testi = leggiTesti();
  controllaTesti(testi);
  controllaAnteprime();
  const gare = leggiGare();

  const dist = join(QUI, "dist");
  rmSync(dist, { recursive: true, force: true });
  cpSync(join(QUI, "public"), dist, { recursive: true });
  for (const lingua of LINGUE) {
    const cartella = join(dist, percorso(lingua));
    mkdirSync(cartella, { recursive: true });
    const calcolati = valoriCalcolati(testi[lingua], lingua, gare);
    writeFileSync(join(cartella, "index.html"), componi(modello, testi[lingua], lingua, calcolati));
  }
  writeFileSync(join(dist, "sitemap.xml"), sitemap());
  writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITO}/sitemap.xml\n`);
  return dist;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = genera();
  console.log(`Generate ${LINGUE.length} lingue in ${dist}`);
}
