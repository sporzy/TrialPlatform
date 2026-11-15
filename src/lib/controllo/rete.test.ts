import { describe, expect, it } from "vitest";
import { AGENTE, consentitoDaRobots, dominioRegistrabile, stessoSito } from "./rete";

describe("dominio", () => {
  it("www e sottodomini sono lo stesso sito; co.uk ha tre livelli", () => {
    expect(dominioRegistrabile("www.sientries.co.uk")).toBe("sientries.co.uk");
    expect(dominioRegistrabile("lavaredo.utmb.world")).toBe("utmb.world");
    expect(stessoSito("http://centurionrunning.com/a", "https://www.centurionrunning.com/b")).toBe(true);
    expect(stessoSito("https://www.gara.it/r", "https://parcheggio-domini.com/")).toBe(false);
  });
});

describe("consentitoDaRobots", () => {
  const robots = `
User-agent: *
Disallow: /privato/
Allow: /privato/regolamento
Disallow: /*.pdf$

User-agent: SemrushBot
Disallow: /
`;
  it("segue il gruppo * con la regola più lunga", () => {
    expect(consentitoDaRobots(robots, AGENTE, "/regolamento/")).toBe(true);
    expect(consentitoDaRobots(robots, AGENTE, "/privato/area")).toBe(false);
    expect(consentitoDaRobots(robots, AGENTE, "/privato/regolamento")).toBe(true);
    expect(consentitoDaRobots(robots, AGENTE, "/docs/regole.pdf")).toBe(false);
  });

  it("il gruppo col nostro nome vince su *; senza regole è tutto consentito", () => {
    expect(consentitoDaRobots(`User-agent: *\nDisallow:\n\nUser-agent: FairKM-controllo\nDisallow: /`, AGENTE, "/x")).toBe(false);
    expect(consentitoDaRobots("", AGENTE, "/x")).toBe(true);
    expect(consentitoDaRobots("User-agent: *\nDisallow: /", AGENTE, "/x")).toBe(false);
  });
});
