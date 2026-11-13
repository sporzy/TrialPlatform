import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Non generare AGENTS.md all'avvio di `next dev`: il contesto per gli agenti sta in CLAUDE.md.
  agentRules: false,
  // Come la landing: /it/, /fr/, ... sempre con la barra finale.
  trailingSlash: true,
  experimental: {
    // Con il layout radice dentro [lingua] il 404 si compone qui (src/app/global-not-found.tsx), come da documentazione di Next.
    globalNotFound: true,
    // Le azioni della redazione (/admin/) arrivano da fairkm.com attraverso il Worker, che inoltra a .onrender.com:
    // Next confronta l'origine con l'host e senza questa voce potrebbe rifiutarle.
    serverActions: { allowedOrigins: ["fairkm.com"] },
  },
};

export default nextConfig;
