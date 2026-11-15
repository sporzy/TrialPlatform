// Avvio della notte di controllo. Lo chiama il timer del Worker Cloudflare, direttamente su Render (non passa da
// fairkm.com). Senza il segreto giusto: 404. Risponde subito; il controllo continua dopo la risposta.

import { after } from "next/server";
import { modalita, segretoValido } from "@/lib/controllo/avvio";
import { eseguiNotte } from "@/lib/controllo/notte";
import { oggiInItalia } from "@/lib/admin/proposte";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!segretoValido(request.headers.get("authorization"), process.env.CONTROLLO_SEGRETO)) {
    return new Response("Not found", { status: 404 });
  }
  const prova = modalita() === "prova";
  after(async () => {
    const riepilogo = await eseguiNotte(pool(), { prova, oggi: oggiInItalia() });
    // Nei log solo i conteggi, non i contenuti delle pagine.
    console.log(
      riepilogo
        ? `controllo notturno (${prova ? "prova" : "attivo"}): ${riepilogo.fonti} fonti, ${JSON.stringify(riepilogo.conteggi)}`
        : "controllo notturno: un altro è già in corso",
    );
  });
  return Response.json({ avviato: true, prova }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
