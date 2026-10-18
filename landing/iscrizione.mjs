// Iscrizione all'avviso di apertura (POST /api/iscrizione), gestita dal Worker.
// Brevo manda l'email di conferma nella lingua della pagina (doppio opt-in):
// il contatto entra nella lista solo dopo aver cliccato il link.
import { LINGUE, percorso } from "./lingue.mjs";

const SITO = "https://fairkm.com";
const BREVO_DOI = "https://api.brevo.com/v3/contacts/doubleOptinConfirmation";

// Brevo: lista "Fair KM – lancio" e modelli dell'email di conferma, uno per lingua.
export const LISTA_LANCIO = 3;
export const MODELLI_CONFERMA = { it: 1, en: 2, fr: 3, de: 4, es: 5 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function risposta(status, corpo) {
  return Response.json(corpo, { status, headers: { "Cache-Control": "no-store" } });
}

// env: BREVO_API_KEY (segreto), LIMITE_IP e LIMITE_EMAIL (rate limiting di Cloudflare, wrangler.jsonc).
// Il limite per email evita che il modulo venga usato per riempire di conferme la casella di qualcun altro.
export async function iscrivi(request, env, chiama = fetch) {
  if (request.method !== "POST") return risposta(405, { errore: "metodo" });
  if (request.headers.get("Origin") !== SITO) return risposta(403, { errore: "origine" });

  let dati;
  try {
    dati = await request.json();
  } catch {
    return risposta(400, { errore: "dati" });
  }
  // Campo nascosto che solo i bot compilano: rispondiamo come se fosse andata bene.
  if (dati?.sito) return risposta(200, { ok: true });

  const email = String(dati?.email ?? "").trim().toLowerCase();
  const lingua = dati?.lingua;
  if (!LINGUE.includes(lingua) || email.length > 254 || !EMAIL.test(email)) {
    return risposta(400, { errore: "dati" });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const [perIp, perEmail] = await Promise.all([
    env.LIMITE_IP.limit({ key: ip }),
    env.LIMITE_EMAIL.limit({ key: email }),
  ]);
  if (!perIp.success || !perEmail.success) return risposta(429, { errore: "troppe" });

  const brevo = await chiama(BREVO_DOI, {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email,
      includeListIds: [LISTA_LANCIO],
      templateId: MODELLI_CONFERMA[lingua],
      redirectionUrl: `${SITO}${percorso(lingua)}conferma/`,
      attributes: { LINGUA: lingua },
    }),
  });
  if (brevo.ok) return risposta(200, { ok: true });

  // Nei log del Worker, senza l'indirizzo email.
  console.error(`Brevo ${brevo.status}: ${await brevo.text()}`);
  return risposta(502, { errore: "servizio" });
}
