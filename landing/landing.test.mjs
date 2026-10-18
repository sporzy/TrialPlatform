// Test della landing: `node --test landing/landing.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  componi,
  controllaAnteprime,
  controllaTesti,
  ISCRIZIONE_ATTIVA,
  leggiTesti,
  sitemap,
  valoriCalcolati,
} from "./build.mjs";
import { leggiGare } from "./dati.mjs";
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

const modello = readFileSync(new URL("./pagina.html", import.meta.url), "utf8");
const gare = leggiGare();
const pagine = (() => {
  const testi = leggiTesti();
  return Object.fromEntries(
    LINGUE.map((l) => [l, componi(modello, testi[l], l, valoriCalcolati(testi[l], l, gare))]),
  );
})();

test("ogni lingua ha tutti i testi della pagina", () => {
  controllaTesti(leggiTesti());
  for (const lingua of LINGUE) {
    assert.doesNotMatch(pagine[lingua], /\{\{/, `${lingua}: segnaposto rimasti`);
    assert.match(pagine[lingua], new RegExp(`<html lang="${lingua}">`));
  }
});

// Testo visibile e attributi letti dagli utenti (non i link), più i testi per lo script.
function testoLeggibile(html) {
  const attributi = [...html.matchAll(/\b(?:aria-label|placeholder|title|content|alt)="([^"]*)"/g)].map((m) => m[1]);
  const { fila, iscrizione } = JSON.parse(html.match(/<script type="application\/json" id="dati-pagina">(.*?)<\/script>/s)[1]);
  const perScript = [...fila.punti.flatMap((p) => [p.aria, p.html]), ...Object.values(iscrizione)];
  const corpo = html
    .replace(/<script\b.*?<\/script>/gs, " ")
    .replace(/<style\b.*?<\/style>/gs, " ")
    .replace(/<[^>]+>/g, " ");
  return [corpo, ...attributi, ...perScript].join(" ");
}

test("nessun testo italiano scritto direttamente nella pagina delle altre lingue", () => {
  const italiane = /\b(gare|costa(no)?|giusto|quota|verificat[oaie]|iscrizione|scheda|distanze|prezzo|riferimento|regolamento|fonte|edizione|avvisami|soglia)\b/i;
  assert.match(testoLeggibile(pagine.it), italiane, "il controllo deve riconoscere l'italiano");
  for (const lingua of LINGUE.filter((l) => l !== "it")) {
    const trovata = testoLeggibile(pagine[lingua]).match(italiane);
    assert.equal(trovata, null, `${lingua}: "${trovata?.[0]}" sembra italiano`);
  }
});

test("i dati per lo script sono JSON valido e senza tag", () => {
  for (const lingua of LINGUE) {
    const json = pagine[lingua].match(/<script type="application\/json" id="dati-pagina">(.*?)<\/script>/s)[1];
    assert.doesNotMatch(json, /</);
    const dati = JSON.parse(json);
    assert.equal(dati.fila.punti.length, gare.fila.length);
    assert.ok(dati.iscrizione.ok && dati.iscrizione.errore && dati.iscrizione.email);
  }
});

test("il modulo d'iscrizione e il bottone che ci porta si vedono solo se l'iscrizione è attiva", () => {
  for (const lingua of LINGUE) {
    const modulo = pagine[lingua].match(/<form class="modulo"[^>]*>/)[0];
    const bottone = pagine[lingua].match(/<a class="bottone" href="#iscrizione"[^>]*>/)[0];
    assert.equal(/\bhidden\b/.test(modulo), !ISCRIZIONE_ATTIVA, lingua);
    assert.equal(/\bhidden\b/.test(bottone), !ISCRIZIONE_ATTIVA, lingua);
  }
});

test("la fila per prezzo usa solo distanze lunghe con prezzo standard, metriche da src/lib", () => {
  assert.ok(gare.fila.length > 0);
  for (const r of gare.fila) {
    assert.ok(r.km >= 30, r.distanceId);
    assert.equal(r.prezzo.scaglione, "standard", r.distanceId);
  }
  assert.ok(gare.fila.every((r) => r.prezzo.edizione >= 2026));
  // Alpe Adria Ultra 120 ha solo il prezzo early: niente costo per km-sforzo, quindi fuori dalla fila.
  assert.ok(!gare.fila.some((r) => r.distanceId.includes("alpe-adria")));
  // Trail dei Nebrodi: fonte secondaria. Ultra Trail Gran Sasso: prezzo ufficiale solo del 2025.
  assert.ok(!gare.fila.some((r) => r.distanceId.includes("nebrodi") || r.distanceId.includes("gran-sasso")));
  assert.equal(gare.esempio.kmSforzo, 80);
  assert.equal(gare.esempio.costoKmSforzo, 50 / 80);
});

test("numeri e prezzi nel formato di ogni lingua, sempre nella valuta della gara", () => {
  assert.match(pagine.it, /0,63\s€/);
  assert.match(pagine.en, /€0\.63/);
  assert.match(pagine.de, /0,63\s€/);
  assert.match(pagine.it, /3\.000/);
  assert.match(pagine.en, /3,000/);
  assert.doesNotMatch(testoLeggibile(pagine.it), /\$|£/);
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

test("ogni lingua ha la sua immagine di anteprima", () => {
  controllaAnteprime();
  assert.throws(() => controllaAnteprime(fileURLToPath(new URL("./testi", import.meta.url))), /Anteprime mancanti: it, en/);
});
