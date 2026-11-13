// Controllo d'accesso per pagine, server action e route di /admin/. Va chiamato in OGNUNA:
// il layout non gira quando si invoca una server action, e il proxy è solo una seconda barriera.

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { configDaAmbiente, INTESTAZIONE_TOKEN, tokenDaRichiesta, verificaToken, type Redattore } from "./accesso";

/** Il redattore della richiesta in corso; se non c'è, 404 (non si rivela nemmeno che /admin/ esiste). */
export async function richiediRedattore(): Promise<Redattore> {
  const h = await headers();
  const redattore = await verificaToken(
    tokenDaRichiesta(h.get(INTESTAZIONE_TOKEN), h.get("cookie")),
    configDaAmbiente(),
  );
  if (!redattore) notFound();
  return redattore;
}
