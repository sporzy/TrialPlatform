"use server";

import { redirect } from "next/navigation";
import { richiediRedattore } from "@/lib/admin/redattore";
import { creaProposta } from "@/lib/admin/scritture";
import { pool } from "@/lib/db";
import { COLONNE_PROPOSTA } from "@/lib/importa-csv";
import { t } from "../testi";

export async function mettiInCoda(form: FormData) {
  await richiediRedattore();
  const riga = Object.fromEntries(COLONNE_PROPOSTA.map((c) => [c, String(form.get(c) ?? "")]));
  const motivo = String(form.get("motivo") ?? "").trim() || t("nuova.motivo");
  const { id, nuova } = await creaProposta(pool(), riga, motivo);
  redirect(`/admin/coda/${id}/${nuova ? "" : "?esistente=1"}`);
}
