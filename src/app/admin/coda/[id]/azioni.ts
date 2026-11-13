"use server";

// Azioni sulla voce della coda. Ognuna controlla di nuovo chi la chiama: una server action è un endpoint
// a sé, il layout non la protegge.

import { redirect } from "next/navigation";
import { oggiInItalia } from "@/lib/admin/proposte";
import { richiediRedattore } from "@/lib/admin/redattore";
import { approvaNuovaGara, salvaBozza, scarta } from "@/lib/admin/scritture";
import { pool } from "@/lib/db";
import { COLONNE_GARE } from "@/lib/importa-csv";

function idDa(form: FormData): number {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Voce non valida");
  return id;
}

function rigaDa(form: FormData): Record<string, string> {
  return Object.fromEntries(COLONNE_GARE.map((c) => [c, String(form.get(c) ?? "")]));
}

export async function salva(form: FormData) {
  await richiediRedattore();
  const id = idDa(form);
  const esito = await salvaBozza(pool(), id, rigaDa(form));
  redirect(`/admin/coda/${id}/?esito=${esito.ok ? "salvata" : "non_approvata"}`);
}

export async function approva(form: FormData) {
  const redattore = await richiediRedattore();
  const id = idDa(form);
  const esito = await approvaNuovaGara(pool(), id, rigaDa(form), redattore.email, oggiInItalia());
  if (esito.ok) redirect(`/admin/?esito=approvata`);
  const errori = encodeURIComponent(esito.errori.join("\n"));
  redirect(`/admin/coda/${id}/?esito=non_approvata&errori=${errori}`);
}

export async function scartaVoce(form: FormData) {
  const redattore = await richiediRedattore();
  const id = idDa(form);
  await scarta(pool(), id, redattore.email);
  redirect(`/admin/?esito=scartata`);
}
