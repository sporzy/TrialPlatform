// Test della landing: `node --test landing/landing.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { componi, controllaTesti, leggiTesti, sitemap } from "./build.mjs";
import { LINGUE, linguaDaBrowser, linguaDaCookie, percorso, scegliLingua } from "./lingue.mjs";

test("lingua del browser: prima lingua supportata in ordine di preferenza", () => {
  assert.equal(linguaDaBrowser("fr-CH,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(linguaDaBrowser("en-GB,en;q=0.9,it;q=0.8"), "en");
  assert.equal(linguaDaBrowser("nl-NL,nl;q=0.9,de;q=0.7"), "de");
  assert.equal(linguaDaBrowser("es;q=0.5,it;q=0.9"), "it");
  assert.equal(linguaDaBrowser("DE-at"), "de");
});

test("lingua del browser: senza intestazione resta l'italiano, se non ne abbiamo nessuna va l'inglese", () => {
  assert.equal(linguaDaBrowser(null), "it");
  assert.equal(linguaDaBrowser(""), "it");
  assert.equal(linguaDaBrowser("nl-NL,nl;q=0.9"), "en");
  assert.equal(linguaDaBrowser("*"), "en");
  assert.equal(linguaDaBrowser("fr;q=0,ja"), "en");
});

test("la scelta fatta col selettore (cookie) vince sul browser", () => {
  assert.equal(scegliLingua("lang=de", "fr-FR,fr"), "de");
  assert.equal(scegliLingua("altro=1; lang=it", "en-GB"), "it");
  assert.equal(scegliLingua("lang=xx", "es-ES"), "es");
  assert.equal(linguaDaCookie(null), null);
});

test("percorsi: italiano alla radice, le altre lingue in una cartella", () => {
  assert.equal(percorso("it"), "/");
  assert.equal(percorso("en"), "/en/");
});

test("ogni lingua ha tutti i testi della pagina", () => {
  const testi = leggiTesti();
  controllaTesti(testi);
  const modello = readFileSync(new URL("./pagina.html", import.meta.url), "utf8");
  for (const lingua of LINGUE) {
    const html = componi(modello, testi[lingua], lingua);
    assert.doesNotMatch(html, /\{\{/, `${lingua}: segnaposto rimasti`);
    assert.match(html, new RegExp(`<html lang="${lingua}">`));
  }
});

test("una traduzione mancante blocca la generazione", () => {
  const testi = leggiTesti();
  delete testi.de["piede.testo"];
  assert.throws(() => controllaTesti(testi), /de\.json: manca "piede\.testo"/);
});

test("la mappa del sito elenca tutte le lingue, ognuna con i link alle altre", () => {
  const xml = sitemap();
  for (const lingua of LINGUE) {
    assert.match(xml, new RegExp(`<loc>https://fairkm.com${percorso(lingua)}</loc>`));
  }
  assert.equal(xml.match(/<url>/g).length, LINGUE.length);
  assert.equal(xml.match(/hreflang="x-default"/g).length, LINGUE.length);
});
