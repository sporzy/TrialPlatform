// Genera public/og/<lingua>.png (1200×630), le immagini di anteprima per le condivisioni.
// Si lancia a mano quando cambia il titolo o la grafica: `node landing/anteprime.mjs`.
// Serve Google Chrome (percorso in CHROME, altrimenti quello standard di macOS).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { componi, leggiTesti } from "./build.mjs";
import { LINGUE } from "./lingue.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const modello = readFileSync(join(QUI, "anteprima.html"), "utf8");
const testi = leggiTesti();
const lavoro = mkdtempSync(join(tmpdir(), "fairkm-anteprime-"));
const uscita = join(QUI, "public", "og");
mkdirSync(uscita, { recursive: true });

try {
  for (const lingua of LINGUE) {
    const pagina = join(lavoro, `${lingua}.html`);
    writeFileSync(pagina, componi(modello, testi[lingua], lingua));
    execFileSync(CHROME, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--user-data-dir=${join(lavoro, "profilo")}`,
      "--window-size=1200,630",
      `--screenshot=${join(uscita, `${lingua}.png`)}`,
      pathToFileURL(pagina).href,
    ], { stdio: "ignore" });
    console.log(`og/${lingua}.png`);
  }
} finally {
  rmSync(lavoro, { recursive: true, force: true });
}
