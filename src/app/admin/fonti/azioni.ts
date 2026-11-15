"use server";

import { redirect } from "next/navigation";
import { annullaConferme } from "@/lib/admin/fonti";
import { richiediRedattore } from "@/lib/admin/redattore";
import { pool } from "@/lib/db";

export async function annulla(form: FormData) {
  const redattore = await richiediRedattore();
  const id = Number(form.get("sourceId"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Fonte non valida");
  await annullaConferme(pool(), id, redattore.email);
  redirect(`/admin/fonti/?esito=annullate`);
}
