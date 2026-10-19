// Test della landing: `node --test landing/landing.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ANALYTICS,
  componi,
  controllaAnteprime,
  controllaTesti,
  ISCRIZIONE_ATTIVA,
  leggiTesti,
  paginaSemplice,
  sitemap,
  valoriCalcolati,
} from "./build.mjs";
import { iscrivi, LISTA_LANCIO, MODELLI_CONFERMA } from "./iscrizione.mjs";
import { leggiGare } from "./dati.mjs";
import { LINGUE, linguaDaBrowser, linguaDaCookie, percorso, scegliLingua } from "./lingue.mjs";
import worker from "./worker.js";

test("lingua del browser: prima lingua supportata in ordine di preferenza", () => {
  assert.equal(linguaDaBrowser("fr-CH,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(linguaDaBrowser("en-GB,en;q=0.9,it;q=0.8"), "en");
  assert.equal(linguaDaBrowser("nl-NL,nl;q=0.9,de;q=0.7"), "de");
  assert.equal(linguaDaBrowser("es;q=0.5,it;q=0.9"), "it");
  assert.equal(linguaDaBrowser("DE-at"), "de");
});

test("lingua del browser: senza intestazione e se non ne abbiamo nessuna va l'inglese", () => {
  assert.equal(linguaDaBrowser(null), "en");
  assert.equal(linguaDaBrowser(""), "en");
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

test("percorsi: inglese alla radice, le altre lingue in una cartella", () => {
  assert.equal(percorso("en"), "/");
  assert.equal(percorso("it"), "/it/");
});

const ASSETS = { fetch: async (r) => new Response(`pagina ${new URL(r.url).pathname}`) };
const visita = (indirizzo, intestazioni = {}) =>
  worker.fetch(new Request(`https://fairkm.com${indirizzo}`, { headers: intestazioni }), { ASSETS });

test("worker: inglese alla radice, le altre lingue rimandate alla loro cartella", async () => {
  assert.equal(await (await visita("/")).text(), "pagina /");
  assert.equal(await (await visita("/", { "Accept-Language": "en-GB" })).text(), "pagina /");
  const it = await visita("/", { "Accept-Language": "it-IT,it;q=0.9" });
  assert.equal(it.status, 302);
  assert.equal(it.headers.get("Location"), "/it/");
  const scelta = await visita("/?lang=en", { "Accept-Language": "it-IT" });
  assert.equal(scelta.headers.get("Location"), "/");
  assert.match(scelta.headers.get("Set-Cookie"), /lang=en/);
});

test("worker: i vecchi indirizzi /en/ portano alla radice", async () => {
  for (const [vecchio, nuovo] of [
    ["/en/", "https://fairkm.com/"],
    ["/en", "https://fairkm.com/"],
    ["/en/conferma/", "https://fairkm.com/conferma/"],
    ["/en/privacy/?a=1", "https://fairkm.com/privacy/?a=1"],
  ]) {
    const r = await visita(vecchio);
    assert.equal(r.status, 301, vecchio);
    assert.equal(r.headers.get("Location"), nuovo, vecchio);
  }
  assert.equal(await (await visita("/entra")).text(), "pagina /entra");
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
  const json = html.match(/<script type="application\/json" id="dati-pagina">(.*?)<\/script>/s)?.[1];
  const { fila, iscrizione } = json ? JSON.parse(json) : { fila: { punti: [] }, iscrizione: {} };
  const perScript = [...fila.punti.flatMap((p) => [p.aria, p.html]), ...Object.values(iscrizione)];
  const corpo = html
    .replace(/<script\b.*?<\/script>/gs, " ")
    .replace(/<style\b.*?<\/style>/gs, " ")
    .replace(/<[^>]+>/g, " ");
  return [corpo, ...attributi, ...perScript].join(" ");
}

const ITALIANE = /\b(gare|costa(no)?|giusto|quota|verificat[oaie]|iscrizione|scheda|distanze|prezzo|riferimento|regolamento|fonte|edizione|avvisami|soglia|grazie)\b/i;

test("nessun testo italiano scritto direttamente nella pagina delle altre lingue", () => {
  assert.match(testoLeggibile(pagine.it), ITALIANE, "il controllo deve riconoscere l'italiano");
  for (const lingua of LINGUE.filter((l) => l !== "it")) {
    const trovata = testoLeggibile(pagine[lingua]).match(ITALIANE);
    assert.equal(trovata, null, `${lingua}: "${trovata?.[0]}" sembra italiano`);
  }
});

test("Cloudflare Web Analytics in ogni pagina, una volta sola", () => {
  const testi = leggiTesti();
  const tutte = LINGUE.flatMap((l) => [
    [`landing ${l}`, pagine[l]],
    ...["conferma", "privacy"].map((n) => [`${n} ${l}`, paginaSemplice(n, testi[l], l, "Titolare di prova")]),
  ]);
  for (const [nome, html] of tutte) assert.equal(html.split(ANALYTICS).length - 1, 1, nome);
});

test("conferma e informativa privacy: complete in ogni lingua, senza italiano nelle altre", () => {
  const testi = leggiTesti();
  for (const nome of ["conferma", "privacy"]) {
    for (const lingua of LINGUE) {
      const html = paginaSemplice(nome, testi[lingua], lingua, "Titolare di prova");
      assert.doesNotMatch(html, /\{\{/, `${nome} ${lingua}: segnaposto rimasti`);
      assert.match(html, /<meta name="robots" content="noindex">/);
      if (lingua !== "it") {
        const trovata = testoLeggibile(html).match(ITALIANE);
        assert.equal(trovata, null, `${nome} ${lingua}: "${trovata?.[0]}" sembra italiano`);
      }
    }
  }
  assert.match(paginaSemplice("privacy", testi.it, "it", "Titolare di prova"), /Titolare di prova\. /);
});

// Iscrizione: Brevo e i limiti di Cloudflare sostituiti da finti.
function richiesta(corpo, { origine = "https://fairkm.com", metodo = "POST" } = {}) {
  return new Request("https://fairkm.com/api/iscrizione", {
    method: metodo,
    headers: { Origin: origine, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
    body: metodo === "POST" ? JSON.stringify(corpo) : undefined,
  });
}

function ambiente(consenti = true) {
  const limite = { limit: async () => ({ success: consenti }) };
  return { BREVO_API_KEY: "chiave-di-prova", LIMITE_IP: limite, LIMITE_EMAIL: limite };
}

function brevoFinto(status = 201) {
  const chiamate = [];
  const chiama = async (url, init) => {
    chiamate.push({ url, init, corpo: JSON.parse(init.body) });
    return new Response(status < 300 ? "{}" : '{"code":"invalid_parameter"}', { status });
  };
  return { chiama, chiamate };
}

test("iscrizione: una lingua per ogni modello dell'email di conferma", () => {
  assert.deepEqual(Object.keys(MODELLI_CONFERMA).sort(), [...LINGUE].sort());
});

test("iscrizione: a Brevo email, lista, modello e pagina di conferma della lingua", async () => {
  const brevo = brevoFinto();
  const r = await iscrivi(richiesta({ email: " Rossi@Example.com ", lingua: "de", sito: "" }), ambiente(), brevo.chiama);
  assert.equal(r.status, 200);
  assert.equal(brevo.chiamate.length, 1);
  const { url, init, corpo } = brevo.chiamate[0];
  assert.equal(url, "https://api.brevo.com/v3/contacts/doubleOptinConfirmation");
  assert.equal(init.headers["api-key"], "chiave-di-prova");
  assert.deepEqual(corpo, {
    email: "rossi@example.com",
    includeListIds: [LISTA_LANCIO],
    templateId: MODELLI_CONFERMA.de,
    redirectionUrl: "https://fairkm.com/de/conferma/",
    attributes: { LINGUA: "de" },
  });

  const it = brevoFinto();
  await iscrivi(richiesta({ email: "a@b.it", lingua: "it" }), ambiente(), it.chiama);
  assert.equal(it.chiamate[0].corpo.redirectionUrl, "https://fairkm.com/it/conferma/");

  const en = brevoFinto();
  await iscrivi(richiesta({ email: "a@b.com", lingua: "en" }), ambiente(), en.chiama);
  assert.equal(en.chiamate[0].corpo.redirectionUrl, "https://fairkm.com/conferma/");
});

test("iscrizione: dati non validi, altre origini e altri metodi non arrivano a Brevo", async () => {
  const casi = [
    [richiesta({ email: "non-una-email", lingua: "it" }), 400],
    [richiesta({ email: "a@b.it", lingua: "nl" }), 400],
    [richiesta({ email: `${"a".repeat(250)}@b.it`, lingua: "it" }), 400],
    [richiesta({ email: "a@b.it", lingua: "it" }, { origine: "https://altro.example" }), 403],
    [richiesta(null, { metodo: "GET" }), 405],
  ];
  for (const [req, status] of casi) {
    const brevo = brevoFinto();
    assert.equal((await iscrivi(req, ambiente(), brevo.chiama)).status, status);
    assert.equal(brevo.chiamate.length, 0);
  }
});

test("iscrizione: il campo trappola risponde ok senza chiamare Brevo", async () => {
  const brevo = brevoFinto();
  const r = await iscrivi(richiesta({ email: "bot@b.it", lingua: "it", sito: "spam" }), ambiente(), brevo.chiama);
  assert.equal(r.status, 200);
  assert.equal(brevo.chiamate.length, 0);
});

test("iscrizione: oltre il limite 429, errore di Brevo 502", async () => {
  const fermo = brevoFinto();
  assert.equal((await iscrivi(richiesta({ email: "a@b.it", lingua: "it" }), ambiente(false), fermo.chiama)).status, 429);
  assert.equal(fermo.chiamate.length, 0);

  const errore = console.error;
  console.error = () => {};
  try {
    const rotto = brevoFinto(400);
    assert.equal((await iscrivi(richiesta({ email: "a@b.it", lingua: "it" }), ambiente(), rotto.chiama)).status, 502);
  } finally {
    console.error = errore;
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

test("la lingua di riferimento dei testi è l'inglese", () => {
  const testi = leggiTesti();
  testi.it["solo.italiano"] = "prova";
  assert.throws(() => controllaTesti(testi), /it\.json: "solo\.italiano" non esiste in en\.json/);
});

test("il piede porta al profilo Instagram, con l'etichetta nella lingua della pagina", () => {
  const testi = leggiTesti();
  for (const lingua of LINGUE) {
    assert.match(pagine[lingua], /href="https:\/\/www\.instagram\.com\/fairkm_trail\/"/);
    assert.ok(pagine[lingua].includes(`aria-label="${testi[lingua]["piede.instagram"]}"`), lingua);
  }
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
  assert.throws(() => controllaAnteprime(fileURLToPath(new URL("./testi", import.meta.url))), /Anteprime mancanti: en, it/);
});
