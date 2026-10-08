import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trail Platform",
  description:
    "Gare trail piccole che costano il giusto rispetto a UTMB e ai grandi circuiti.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
