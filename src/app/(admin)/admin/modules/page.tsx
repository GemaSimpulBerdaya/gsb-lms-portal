"use client";

import styles from "./modules.module.css";
import ModulesPanel from "./_panels/ModulesPanel";

export default function AdminModulesPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Modul Pembelajaran</h1>
        <p className={styles.subtitle}>
          Kelola materi pembelajaran untuk kelas Reguler (Online & Offline) dan SNBT (Online)
        </p>
      </div>

      <ModulesPanel />
    </div>
  );
}
