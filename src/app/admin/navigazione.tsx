import Link from "next/link";
import styles from "./admin.module.css";
import { t } from "./testi";

export function Navigazione() {
  return (
    <nav className={styles.navigazione} aria-label="Redazione">
      <Link href="/admin/">{t("nav.coda")}</Link>
      <Link href="/admin/gare/">{t("nav.gare")}</Link>
      <Link href="/admin/nuova/">{t("nav.nuova")}</Link>
    </nav>
  );
}
