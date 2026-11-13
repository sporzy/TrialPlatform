// Chi può entrare in /admin/: solo chi è passato da Cloudflare Access (policy con l'email della redazione).
// Access aggiunge alla richiesta un token firmato (JWT): qui se ne verifica la firma con le chiavi pubbliche
// del team, il pubblico (AUD dell'applicazione Access), l'emittente e la scadenza. La sola presenza non basta:
// l'app è raggiungibile anche direttamente su .onrender.com, dove chiunque può scrivere un'intestazione.
// Senza configurazione (CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD) nessuno entra.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const INTESTAZIONE_TOKEN = "cf-access-jwt-assertion";
export const COOKIE_TOKEN = "CF_Authorization";

export interface ConfigAccesso {
  /** Es. "fairkm.cloudflareaccess.com", senza https:// né barra. */
  teamDomain: string;
  /** "Application Audience (AUD) Tag" dell'applicazione Access. */
  aud: string;
}

export interface Redattore {
  email: string;
}

/** Configurazione dalle variabili d'ambiente; `null` se manca qualcosa (= /admin/ chiuso). */
export function configDaAmbiente(env: Record<string, string | undefined> = process.env): ConfigAccesso | null {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !aud) return null;
  return { teamDomain, aud };
}

// Le chiavi del team si scaricano una volta e jose le tiene in memoria (e le riscarica se cambiano).
const chiaviPerTeam = new Map<string, JWTVerifyGetKey>();

function chiaviRemote(teamDomain: string): JWTVerifyGetKey {
  let chiavi = chiaviPerTeam.get(teamDomain);
  if (!chiavi) {
    chiavi = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    chiaviPerTeam.set(teamDomain, chiavi);
  }
  return chiavi;
}

/**
 * Solo per provare la redazione in locale con `next dev` (NODE_ENV=development), dove Cloudflare Access non c'è:
 * FAIRKM_ADMIN_LOCALE=email fa entrare come quell'email. In produzione (next start, Render) è ignorato.
 */
export function redattoreLocale(env: Record<string, string | undefined> = process.env): Redattore | null {
  const email = env.FAIRKM_ADMIN_LOCALE?.trim();
  return env.NODE_ENV === "development" && email ? { email } : null;
}

/** Token dalla richiesta: l'intestazione di Access o, in mancanza, il suo cookie. */
export function tokenDaRichiesta(intestazione: string | null | undefined, cookie: string | null | undefined): string | null {
  if (intestazione?.trim()) return intestazione.trim();
  const valore = cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_TOKEN}=`))
    ?.slice(COOKIE_TOKEN.length + 1);
  return valore || null;
}

/**
 * Verifica il token di Access. Restituisce il redattore o `null` (token assente, non valido, scaduto,
 * di un'altra applicazione o di un altro team). Non lancia mai: ogni errore vale "fuori".
 * `chiavi` serve ai test, per firmare con una chiave locale.
 */
export async function verificaToken(
  token: string | null,
  config: ConfigAccesso | null,
  chiavi?: JWTVerifyGetKey,
): Promise<Redattore | null> {
  if (!token || !config) return null;
  try {
    const { payload } = await jwtVerify(token, chiavi ?? chiaviRemote(config.teamDomain), {
      issuer: `https://${config.teamDomain}`,
      audience: config.aud,
      // Access firma con RS256; qualunque altro algoritmo (compreso "none") è rifiutato.
      algorithms: ["RS256"],
      requiredClaims: ["exp", "email"],
    });
    return typeof payload.email === "string" && payload.email ? { email: payload.email } : null;
  } catch {
    return null;
  }
}
