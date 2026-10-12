// Carica .env.local (se c'è) per gli script lanciati a mano. Non stampa mai i valori.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Nessun .env.local: si usa l'ambiente così com'è (es. su Render).
}
