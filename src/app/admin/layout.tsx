// Layout radice della redazione, separato da quello pubblico ([lingua]): solo italiano, mai indicizzato.

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { richiediRedattore } from "@/lib/admin/redattore";
import "../globals.css";
import styles from "./admin.module.css";
import { T } from "./testi";

export const metadata: Metadata = {
  title: T.titolo,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  await richiediRedattore();
  return (
    <html lang="it">
      <body className={styles.corpo}>{children}</body>
    </html>
  );
}
