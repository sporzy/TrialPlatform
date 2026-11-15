// Chi può avviare la notte di controllo: solo chi conosce CONTROLLO_SEGRETO (il timer del Worker Cloudflare).
// La modalità la decide il server (CONTROLLO_MODALITA), non chi chiama: "prova" finché non si accende.

import { createHash, timingSafeEqual } from "node:crypto";

export type Modalita = "prova" | "attivo";

export function modalita(env: Record<string, string | undefined> = process.env): Modalita {
  return env.CONTROLLO_MODALITA === "attivo" ? "attivo" : "prova";
}

/** Confronto a tempo costante (sulle impronte, così anche lunghezze diverse non si notano). Senza segreto: no. */
export function segretoValido(intestazione: string | null, segreto: string | undefined): boolean {
  if (!segreto || segreto.length < 32 || !intestazione?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(intestazione.slice("Bearer ".length)).digest();
  const b = createHash("sha256").update(segreto).digest();
  return timingSafeEqual(a, b);
}
