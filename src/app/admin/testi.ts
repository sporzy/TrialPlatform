// Testi della redazione (/admin/): solo in italiano, la usa solo la redazione (eccezione in CLAUDE.md).
// Restano comunque qui e non nei componenti: se un giorno servissero altre lingue, si divide questo file.

export const T = {
  titolo: "Fair KM · redazione",
  sottotitolo: "Coda di revisione e dati delle gare. Niente va online senza approvazione.",
  entrato: "Entrato come {email}",
  sito: "Vai al sito",
  "coda.titolo": "Coda di revisione",
  "coda.vuota": "Nessuna voce aperta.",
  "coda.aperte": "{n} voci aperte",
  "coda.colonna.voce": "Voce",
  "coda.colonna.origine": "Origine",
  "coda.colonna.motivo": "Motivo",
  "coda.colonna.data": "Arrivata il",
  "origine.cambio_fonte": "Cambio della fonte",
  "origine.link_rotto": "Link rotto",
  "origine.nuova_gara": "Nuova gara",
  "origine.segnalazione": "Segnalazione",
  "dati.titolo": "Nel database",
  "dati.conteggi": "{gare} gare, {distanze} distanze, {prezzi} prezzi",
} as const;

export type ChiaveAdmin = keyof typeof T;

/** Testo con i segnaposto {nome} sostituiti. */
export function t(chiave: ChiaveAdmin, valori: Record<string, string | number> = {}): string {
  return T[chiave].replace(/\{(\w+)\}/g, (_, nome: string) => String(valori[nome] ?? `{${nome}}`));
}
