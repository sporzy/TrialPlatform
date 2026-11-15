// Regole di buon vicinato e di rete per il controllo notturno. Funzioni pure.

/** Nome con cui il controllo si presenta ai siti (e con cui si cerca in robots.txt). */
export const AGENTE = "FairKM-controllo";
export const USER_AGENT = `${AGENTE}/1.0 (+https://fairkm.com)`;

// Domini di secondo livello comuni: example.co.uk → example.co.uk, non co.uk.
const SECONDO_LIVELLO = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk", "com.au", "co.nz"]);

/** Dominio "registrabile": www.sientries.co.uk e sientries.co.uk sono lo stesso sito. */
export function dominioRegistrabile(host: string): string {
  const parti = host.toLowerCase().replace(/\.$/, "").split(".");
  const ultimeDue = parti.slice(-2).join(".");
  return SECONDO_LIVELLO.has(ultimeDue) ? parti.slice(-3).join(".") : ultimeDue;
}

export function stessoSito(a: string, b: string): boolean {
  return dominioRegistrabile(new URL(a).hostname) === dominioRegistrabile(new URL(b).hostname);
}

interface Regola {
  consenti: boolean;
  percorso: string;
}

/**
 * robots.txt: vale il gruppo che nomina il nostro agente, altrimenti quello per "*". Tra le regole vince la più
 * lunga che corrisponde (a parità, Allow). Supporta * e $ come da specifica (RFC 9309).
 */
export function consentitoDaRobots(robots: string, agente: string, percorso: string): boolean {
  const gruppi: { agenti: string[]; regole: Regola[] }[] = [];
  let corrente: { agenti: string[]; regole: Regola[] } | null = null;
  let ultimoEraAgente = false;
  for (const grezza of robots.split(/\r?\n/)) {
    const riga = grezza.replace(/#.*/, "").trim();
    const m = riga.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, chiave, valore] = m;
    const k = chiave.toLowerCase();
    if (k === "user-agent") {
      if (!corrente || !ultimoEraAgente) {
        corrente = { agenti: [], regole: [] };
        gruppi.push(corrente);
      }
      corrente.agenti.push(valore.toLowerCase());
      ultimoEraAgente = true;
    } else if ((k === "allow" || k === "disallow") && corrente) {
      ultimoEraAgente = false;
      if (valore) corrente.regole.push({ consenti: k === "allow", percorso: valore });
    } else {
      ultimoEraAgente = false;
    }
  }
  const nostro = agente.toLowerCase();
  const gruppo =
    gruppi.find((g) => g.agenti.some((a) => a !== "*" && nostro.includes(a))) ?? gruppi.find((g) => g.agenti.includes("*"));
  if (!gruppo) return true;
  let migliore: Regola | null = null;
  for (const r of gruppo.regole) {
    if (!corrisponde(r.percorso, percorso)) continue;
    if (!migliore || r.percorso.length > migliore.percorso.length || (r.percorso.length === migliore.percorso.length && r.consenti)) {
      migliore = r;
    }
  }
  return migliore?.consenti ?? true;
}

function corrisponde(regola: string, percorso: string): boolean {
  const ancorata = regola.endsWith("$");
  const corpo = (ancorata ? regola.slice(0, -1) : regola)
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${corpo}${ancorata ? "$" : ""}`).test(percorso);
}
