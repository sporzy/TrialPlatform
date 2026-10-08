import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Finché non ci sono test (arrivano al passo 3), `npm test` non deve fallire.
    passWithNoTests: true,
  },
});
