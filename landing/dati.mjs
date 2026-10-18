// Dati delle gare per la landing, letti da data/gare.csv con le stesse funzioni dell'app
// (src/lib/elenco.ts, metriche.ts, soglie.ts): qui non si calcola nessuna metrica.
// Si sceglie solo cosa mostrare e lo si formatta nella lingua della pagina, in valuta locale.
import { readFileSync } from "node:fs";
import { tsImport } from "tsx/esm/api";

const { importaGare, parseCsv, slug } = await tsImport("../src/lib/importa-csv.ts", import.meta.url);
const { costruisciElenco } = await tsImport("../src/lib/elenco.ts", import.meta.url);
const { SOGLIE } = await tsImport("../src/lib/soglie.ts", import.meta.url);

// La gara del cartellino e del conto d'esempio, e quella della scheda.
const ESEMPIO = "it-100-miglia-monviso--100-miglia-monviso-m50k";
const SCHEDA = "it-sciacchetrail--sciacchetrail-100k";
// La fila per prezzo: distanze lunghe di un paese solo, perché le soglie valgono in valuta locale.
const PAESE_FILA = "IT";
// Sulla landing solo prezzi da fonte primaria e di edizioni attuali: senza, la distanza resta fuori.
const EDIZIONE_MINIMA = 2026;
// Estremi della fila, in costo per km-sforzo.
const FILA_MIN = 0.5;
const FILA_MAX = 2.4;

const LOCALE = { it: "it-IT", en: "en-GB", fr: "fr-FR", de: "de-DE", es: "es-ES" };

// Nomi dei punti e dei badge della pagina per ogni fascia di metriche.ts.
const FASCE = { giusto: "giusto", sopra_soglia: "sopra", grandi_circuiti: "circuiti" };

// Tipo di fonte per distanza (colonna fonte_tipo, che importaGare non porta nei dati), con gli stessi id.
function tipiFonte(testo) {
  const [intestazione, ...righe] = parseCsv(testo);
  const colonna = (nome) => intestazione.indexOf(nome);
  return new Map(
    righe.map((r) => [
      `${slug(`${r[colonna("paese")]} ${r[colonna("evento")]}`)}--${slug(r[colonna("distanza")])}`,
      r[colonna("fonte_tipo")].trim(),
    ]),
  );
}

export function leggiGare() {
  const testo = readFileSync(new URL("../data/gare.csv", import.meta.url), "utf8");
  const dati = importaGare(testo);
  const fonti = tipiFonte(testo);
  const pubblicabile = (r) =>
    (fonti.get(r.distanceId) ?? "").startsWith("primaria") && r.prezzo.edizione >= EDIZIONE_MINIMA;
  const righe = costruisciElenco(dati).flatMap((s) => s.righe.map((r) => ({ ...r, paese: s.paese })));
  const riga = (id) => {
    const r = righe.find((x) => x.distanceId === id);
    if (!r) throw new Error(`landing: manca la distanza ${id} in data/gare.csv`);
    if (!r.fascia) throw new Error(`landing: ${id} non ha un prezzo standard`);
    if (!pubblicabile(r)) throw new Error(`landing: ${id} senza fonte primaria o prezzo ${EDIZIONE_MINIMA}+`);
    return r;
  };

  const esempio = riga(ESEMPIO);
  // I testi del metodo dicono che l'esempio costa il giusto.
  if (esempio.fascia !== "giusto") throw new Error(`landing: ${ESEMPIO} non costa più il giusto, cambia l'esempio`);

  const scheda = riga(SCHEDA);
  const precedente =
    dati.prices
      .filter((p) => p.distanceId === SCHEDA && p.scaglione === "standard" && p.edizione < scheda.prezzo.edizione)
      .sort((a, b) => b.edizione - a.edizione)[0] ?? null;

  // Senza prezzo standard niente costo né fascia (src/lib/elenco.ts): quelle distanze restano fuori.
  const fila = righe
    .filter((r) => r.paese === PAESE_FILA && r.km >= SOGLIE.kmGaraLunga && r.fascia && r.fascia in FASCE)
    .filter(pubblicabile)
    .sort((a, b) => a.costoKmSforzo - b.costoKmSforzo);
  const fuori = fila.filter((r) => r.costoKmSforzo < FILA_MIN || r.costoKmSforzo > FILA_MAX);
  if (fuori.length) throw new Error(`landing: costi fuori dalla fila (${FILA_MIN}–${FILA_MAX}): ${fuori.map((r) => r.distanceId)}`);

  return { esempio, scheda, precedente, fila };
}

export function esc(testo) {
  return String(testo).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function formattatori(lingua) {
  const locale = LOCALE[lingua];
  // In spagnolo 3000 resta senza separatore (norma RAE); nelle altre lingue 3.000, come in src/lib/formato.ts.
  const useGrouping = lingua === "es" ? "min2" : "always";
  const numero = (n, cifre = 0) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: cifre, maximumFractionDigits: cifre, useGrouping }).format(n);
  return {
    numero,
    km: (n) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping }).format(n),
    valuta: (n, valuta, cifre = n % 1 ? 2 : 0) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: valuta,
        minimumFractionDigits: cifre,
        maximumFractionDigits: cifre,
      }).format(n),
    data: (iso) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso)),
    percentuale: (n) => {
      const p = Math.round(n * 100);
      return p === 0 ? "0%" : `${p > 0 ? "+" : "−"}${numero(Math.abs(p))}%`;
    },
  };
}

export function formattaData(lingua, iso) {
  return formattatori(lingua).data(iso);
}

const nome = (r) => (r.distanza ? `${r.gara} · ${r.distanza}` : r.gara);
const posizione = (costo) => (costo - FILA_MIN) / (FILA_MAX - FILA_MIN);

// Valori calcolati della pagina ({{d.*}} nel modello e nei testi), già formattati e con l'HTML escapato.
export function valoriGare(gare, lingua, t) {
  const f = formattatori(lingua);
  const { esempio, scheda, precedente, fila } = gare;
  const costo = (r) => f.valuta(r.costoKmSforzo, r.prezzo.valuta, 2);
  const soglia = (v) => f.valuta(v, esempio.prezzo.valuta, 2);

  const valori = {
    "d.soglia.km": f.numero(SOGLIE.kmGaraLunga),
    "d.soglia.giusto": soglia(SOGLIE.costoGiustoGaraLunga),
    "d.soglia.circuiti": soglia(SOGLIE.limiteGrandiCircuiti),
  };

  const scrivi = (prefisso, r) =>
    Object.assign(valori, {
      [`${prefisso}.nome`]: esc(nome(r)),
      [`${prefisso}.gara`]: esc(r.gara),
      [`${prefisso}.distanza`]: esc(r.distanza),
      [`${prefisso}.luogo`]: esc(r.regione ?? ""),
      [`${prefisso}.edizione`]: String(r.prezzo.edizione),
      [`${prefisso}.km`]: f.km(r.km),
      [`${prefisso}.dplus`]: f.numero(r.dplus),
      [`${prefisso}.kmsforzo`]: f.km(r.kmSforzo),
      [`${prefisso}.prezzo`]: f.valuta(r.prezzo.prezzo, r.prezzo.valuta),
      [`${prefisso}.costo`]: costo(r),
      [`${prefisso}.fascia`]: FASCE[r.fascia],
      [`${prefisso}.fascia.nome`]: t[`fascia.${FASCE[r.fascia]}`],
      [`${prefisso}.fonte`]: esc(r.prezzo.fonteUrl),
      [`${prefisso}.verificato`]: f.data(r.prezzo.dataRilevazione),
    });
  scrivi("d.esempio", esempio);
  scrivi("d.scheda", scheda);

  // Storico della scheda: confronto calcolato da elenco.ts (stesso scaglione, stessa valuta).
  if (!precedente || scheda.aumento?.tipo !== "prezzo") throw new Error(`landing: ${SCHEDA} senza storico confrontabile`);
  Object.assign(valori, {
    "d.scheda.precedente.edizione": String(precedente.edizione),
    "d.scheda.precedente.prezzo": f.valuta(precedente.prezzo, precedente.valuta),
    "d.scheda.precedente.fonte": esc(precedente.fonteUrl),
    "d.scheda.aumento": f.percentuale(scheda.aumento.valore),
  });
  valori["d.scheda.storico"] = scheda.aumento.valore === 0 ? t["scheda.storico.invariato"] : t["scheda.storico.variato"];

  // Fila per prezzo: i punti li dispone lo script della pagina, la tabella è già pronta.
  const gareFila = fila.filter((r) => !r.riferimentoNazionale);
  valori["d.fila.totale"] = f.numero(gareFila.length);
  valori["d.fila.giusto"] = f.numero(gareFila.filter((r) => r.fascia === "giusto").length);

  const dettagli = (r) =>
    `${f.km(r.km)} km · ${f.numero(r.dplus)} ${t["unita.dplus"]} · ${f.valuta(r.prezzo.prezzo, r.prezzo.valuta)}`;
  const nota = (r) => {
    if (!r.riferimentoNazionale) return t[`fascia.${FASCE[r.fascia]}`];
    const iva = r.prezzo.includeIva && r.prezzo.includeCommissioni ? `, ${t["fila.iva_inclusa"]}` : "";
    return `${t["fila.riferimento"]} · ${t["fila.edizione_breve"]} ${r.prezzo.edizione}${iva}`;
  };
  const punti = fila.map((r) => ({
    pos: posizione(r.costoKmSforzo),
    classe: `${FASCE[r.fascia]}${r.riferimentoNazionale ? " riferimento" : ""}`,
    aria: `${nome(r)}: ${dettagli(r)}, ${costo(r)} ${t["unita.per_kmsforzo"]}, ${nota(r)}`,
    html: `<strong>${esc(nome(r))}</strong>${dettagli(r)}<br>${costo(r)} ${t["unita.per_kmsforzo"]} · ${nota(r)}`,
  }));
  const tacche = [0.5, SOGLIE.costoGiustoGaraLunga, SOGLIE.limiteGrandiCircuiti, 2].map((v) => ({
    pos: posizione(v),
    testo: f.numero(v, 2),
    soglia: v === SOGLIE.costoGiustoGaraLunga || v === SOGLIE.limiteGrandiCircuiti,
  }));
  const fasce = [
    [0, posizione(SOGLIE.costoGiustoGaraLunga), "var(--giusto)"],
    [posizione(SOGLIE.costoGiustoGaraLunga), posizione(SOGLIE.limiteGrandiCircuiti), "var(--sopra)"],
    [posizione(SOGLIE.limiteGrandiCircuiti), 1, "var(--circuiti)"],
  ];
  valori["d.fila.dati"] = { punti, tacche, fasce };

  valori["d.fila.righe"] = fila
    .map(
      (r) =>
        `<tr><td>${esc(nome(r))}${r.riferimentoNazionale ? ` (${t["fila.riferimento"]})` : ""}</td>` +
        `<td>${f.km(r.km)}</td><td>${f.numero(r.dplus)}</td>` +
        `<td>${f.valuta(r.prezzo.prezzo, r.prezzo.valuta)}</td><td>${costo(r)}</td></tr>`,
    )
    .join("\n");

  return valori;
}
