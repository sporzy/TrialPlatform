"use client";

// Migliorie del modulo dei filtri, solo con JavaScript e dopo che React ha preso in carico la pagina
// (cambiare il DOM prima darebbe errori di idratazione): invio a ogni scelta (la ricerca parte con Invio),
// filtri aperti su schermi larghi, pulsante "Mostra le gare" nascosto perché non serve.
// Senza JavaScript tutto funziona lo stesso: c'è il pulsante e i filtri si aprono a mano.

import { useEffect } from "react";

export function MiglioreFiltri({ id, classeJs }: { id: string; classeJs: string }) {
  useEffect(() => {
    const modulo = document.getElementById(id) as HTMLFormElement | null;
    if (!modulo) return;
    modulo.classList.add(classeJs);
    const dettagli = modulo.querySelector("details");
    if (dettagli && window.matchMedia("(min-width: 900px)").matches) dettagli.open = true;
    const invia = (e: Event) => {
      if ((e.target as HTMLInputElement).type !== "search") modulo.requestSubmit();
    };
    modulo.addEventListener("change", invia);
    return () => modulo.removeEventListener("change", invia);
  }, [id, classeJs]);
  return null;
}
