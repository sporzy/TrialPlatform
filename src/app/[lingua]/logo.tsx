// Logo di Fair KM, lo stesso della landing (landing/public/logo/fairkm-verde.svg), disegnato in currentColor:
// verde su carta chiara, menta sul tema scuro, come nella testata della landing.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SVG = readFileSync(join(process.cwd(), "landing", "public", "logo", "fairkm-verde.svg"), "utf8")
  .replace(/#1d5a36/gi, "currentColor")
  .replace("<svg ", '<svg aria-hidden="true" focusable="false" ');

export function Logo() {
  return <span dangerouslySetInnerHTML={{ __html: SVG }} />;
}
