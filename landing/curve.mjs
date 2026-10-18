// Curve di livello decorative della landing (non sono un percorso reale), con lo stesso tratto del logo.
// Si calcolano in build con d3 (strumenti/d3.min.js, v7.9.0): la pagina non carica script esterni.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const contesto = {};
vm.createContext(contesto);
vm.runInContext(readFileSync(new URL("./strumenti/d3.min.js", import.meta.url), "utf8"), contesto);
const { d3 } = contesto;

// Griglia della carta: viewBox="0 0 96 60" nel modello.
const L = 96;
const A = 60;

// rilievi: [x, y, raggio, altezza] di ogni cima. Una curva ogni `passo`, una maestra ogni 5.
function curve(rilievi, passo = 0.075) {
  const valori = new Float64Array(L * A);
  for (let y = 0; y < A; y++)
    for (let x = 0; x < L; x++) {
      let h = 0;
      for (const [cx, cy, r, p] of rilievi) h += p * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
      h += 0.06 * Math.sin(x / 5.3 + y / 9.1) + 0.05 * Math.cos(y / 4.7 - x / 11.3);
      valori[y * L + x] = h;
    }
  const percorso = d3.geoPath().digits(2);
  return d3
    .contours()
    .size([L, A])
    .thresholds(d3.range(0.08, 2.4, passo))(valori)
    .filter((c) => c.coordinates.length)
    .map((c, i) => `<path${i % 5 === 4 ? ' class="maestra"' : ""} d="${percorso(c)}"/>`)
    .join("");
}

export const CURVE = {
  "curve.apertura": curve([
    [74, 22, 11, 1.6],
    [88, 44, 9, 1.1],
    [58, 48, 8, 0.7],
    [92, 8, 7, 0.8],
    [30, 12, 10, 0.5],
  ]),
  "curve.scheda": curve([
    [76, 18, 12, 1.4],
    [92, 42, 10, 1.0],
    [56, 6, 8, 0.6],
  ]),
  "curve.banda": curve(
    [
      [20, 40, 12, 1.3],
      [80, 18, 10, 1.1],
      [52, 58, 9, 0.7],
    ],
    0.1,
  ),
};
