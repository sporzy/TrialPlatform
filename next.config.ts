import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Non generare AGENTS.md all'avvio di `next dev`: il contesto per gli agenti sta in CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
