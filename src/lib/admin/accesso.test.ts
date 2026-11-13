import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { configDaAmbiente, tokenDaRichiesta, verificaToken, type ConfigAccesso } from "./accesso";

const CONFIG: ConfigAccesso = { teamDomain: "prova.cloudflareaccess.com", aud: "aud-giusto" };
const ORA = Math.floor(Date.now() / 1000);

let chiavi: ReturnType<typeof createLocalJWKSet>;
let privata: CryptoKey;
let altraPrivata: CryptoKey;

beforeAll(async () => {
  const coppia = await generateKeyPair("RS256", { extractable: true });
  const altra = await generateKeyPair("RS256", { extractable: true });
  privata = coppia.privateKey;
  altraPrivata = altra.privateKey;
  const jwk: JWK = { ...(await exportJWK(coppia.publicKey)), kid: "k1", alg: "RS256" };
  chiavi = createLocalJWKSet({ keys: [jwk] });
});

function token(
  over: { aud?: string; iss?: string; exp?: number; email?: string | null } = {},
  chiave: CryptoKey = privata,
) {
  const { aud = CONFIG.aud, iss = `https://${CONFIG.teamDomain}`, exp = ORA + 600, email = "redazione@example.com" } = over;
  return new SignJWT(email === null ? {} : { email })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt(ORA - 10)
    .setExpirationTime(exp)
    .sign(chiave);
}

describe("verificaToken", () => {
  it("accetta un token firmato dal team, per questa applicazione, non scaduto", async () => {
    expect(await verificaToken(await token(), CONFIG, chiavi)).toEqual({ email: "redazione@example.com" });
  });

  it("rifiuta un'altra applicazione (AUD) o un altro team (emittente)", async () => {
    expect(await verificaToken(await token({ aud: "aud-di-un-altra-app" }), CONFIG, chiavi)).toBeNull();
    expect(await verificaToken(await token({ iss: "https://altro.cloudflareaccess.com" }), CONFIG, chiavi)).toBeNull();
  });

  it("rifiuta un token scaduto", async () => {
    expect(await verificaToken(await token({ exp: ORA - 60 }), CONFIG, chiavi)).toBeNull();
  });

  it("rifiuta un token firmato con un'altra chiave", async () => {
    expect(await verificaToken(await token({}, altraPrivata), CONFIG, chiavi)).toBeNull();
  });

  it('rifiuta un token non firmato (alg "none") e uno inventato', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const nessunaFirma = `${b64({ alg: "none" })}.${b64({ aud: CONFIG.aud, iss: `https://${CONFIG.teamDomain}`, exp: ORA + 600, email: "x@y.z" })}.`;
    expect(await verificaToken(nessunaFirma, CONFIG, chiavi)).toBeNull();
    expect(await verificaToken("non-un-token", CONFIG, chiavi)).toBeNull();
  });

  it("rifiuta un token senza email", async () => {
    expect(await verificaToken(await token({ email: null }), CONFIG, chiavi)).toBeNull();
  });

  it("senza token o senza configurazione nessuno entra", async () => {
    expect(await verificaToken(null, CONFIG, chiavi)).toBeNull();
    expect(await verificaToken(await token(), null, chiavi)).toBeNull();
  });
});

describe("configDaAmbiente", () => {
  it("serve sia il team sia l'AUD; https:// e barra finale si tolgono", () => {
    expect(configDaAmbiente({ CF_ACCESS_TEAM_DOMAIN: "https://prova.cloudflareaccess.com/", CF_ACCESS_AUD: "a" }))
      .toEqual({ teamDomain: "prova.cloudflareaccess.com", aud: "a" });
    expect(configDaAmbiente({ CF_ACCESS_TEAM_DOMAIN: "prova.cloudflareaccess.com" })).toBeNull();
    expect(configDaAmbiente({ CF_ACCESS_AUD: "a" })).toBeNull();
  });
});

describe("tokenDaRichiesta", () => {
  it("prima l'intestazione di Access, poi il cookie CF_Authorization", () => {
    expect(tokenDaRichiesta("abc", "CF_Authorization=def")).toBe("abc");
    expect(tokenDaRichiesta(null, "lang=it; CF_Authorization=def; altro=1")).toBe("def");
    expect(tokenDaRichiesta("", "lang=it")).toBeNull();
    expect(tokenDaRichiesta(undefined, undefined)).toBeNull();
  });
});
