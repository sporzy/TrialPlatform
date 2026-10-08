// Soglie provvisorie (CLAUDE.md, "Soglie provvisorie"): da ricalibrare con più dati.
// Valgono per tutti i paesi e in valuta locale: un solo metro di misura, nessuna conversione.
export const SOGLIE = {
  /** Da questa distanza (km reali, non km-sforzo) una gara è "lunga". */
  kmGaraLunga: 30,
  /** Costo per km-sforzo massimo per "costa il giusto", gare ≥ 30 km. */
  costoGiustoGaraLunga: 1.0,
  /** Costo per km-sforzo massimo per "costa il giusto", gare < 30 km. */
  costoGiustoGaraCorta: 1.2,
  /** Oltre questo costo per km-sforzo si è nella fascia dei grandi circuiti. */
  limiteGrandiCircuiti: 1.5,
  /** Aumento anno su anno oltre il quale scatta il badge rosso (+15%). */
  aumentoRosso: 0.15,
} as const;
