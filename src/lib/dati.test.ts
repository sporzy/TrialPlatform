import { afterEach, describe, expect, it, vi } from "vitest";
import { caricaDati } from "./dati";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("caricaDati senza DATABASE_URL", () => {
  it("in sviluppo legge i dati d'esempio", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect((await caricaDati()).distances).toHaveLength(102);
  });

  it("in produzione si ferma: mai dati vecchi mostrati come attuali", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(caricaDati()).rejects.toThrow(/DATABASE_URL/);
  });
});
