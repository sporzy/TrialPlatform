"use server";

import { redirect } from "next/navigation";
import { leggiModulo, salvaModifica } from "@/lib/admin/modifiche";
import { oggiInItalia } from "@/lib/admin/proposte";
import { richiediRedattore } from "@/lib/admin/redattore";
import { pool } from "@/lib/db";

export async function salvaCorrezioni(form: FormData) {
  const redattore = await richiediRedattore();
  const id = String(form.get("distanceId") ?? "");
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Distanza non valida");
  const campi = new Map<string, string>();
  for (const [k, v] of form.entries()) if (typeof v === "string") campi.set(k, v);
  const esito = await salvaModifica(pool(), id, leggiModulo(campi), redattore.email, oggiInItalia());
  if (esito.ok) redirect(`/admin/gare/${id}/?esito=salvata`);
  redirect(`/admin/gare/${id}/?esito=non_salvata&errori=${encodeURIComponent(esito.errori.join("\n"))}`);
}
