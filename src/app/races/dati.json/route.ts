// Dati delle gare in JSON, in sola lettura: gli stessi fatti che l'elenco mostra, con le fonti.
// Li legge la landing quando viene generata (landing/dati.mjs), così anche lei ha un'unica fonte: Postgres.
// Su fairkm.com è /races/dati.json: il Worker lo inoltra qui come ogni percorso sotto /races/.

import { caricaDati } from "@/lib/dati";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await caricaDati(), { headers: { "Cache-Control": "no-store" } });
}
