import { describe, expect, it } from "vitest";
import { voceDaRiga } from "./coda";

const quando = new Date("2026-11-13T21:51:28Z");

describe("voceDaRiga", () => {
  it("una nuova gara si legge come gara · distanza, con il motivo", () => {
    const voce = voceDaRiga({
      id: "7",
      origine: "nuova_gara",
      diff_testo: "fonte ufficiale da trovare",
      proposta: { chiave: "it-x--y", riga: { evento: "Adamello Ultra Trail", distanza: "AUT 170" } },
      creato_il: quando,
    });
    expect(voce).toEqual({
      id: 7,
      origine: "nuova_gara",
      titolo: "Adamello Ultra Trail · AUT 170",
      motivo: "fonte ufficiale da trovare",
      creatoIl: "2026-11-13T21:51:28.000Z",
    });
  });

  it("senza riga leggibile resta la chiave, o il numero della voce", () => {
    expect(voceDaRiga({ id: 3, origine: "link_rotto", diff_testo: null, proposta: { chiave: "k" }, creato_il: quando }).titolo).toBe("k");
    expect(voceDaRiga({ id: 3, origine: "link_rotto", diff_testo: null, proposta: null, creato_il: quando }).titolo).toBe("#3");
  });
});
