"use client";

import { useState } from "react";
import styles from "./modules.module.css";
import ModulesPanel from "./_panels/ModulesPanel";
import MateriAjarPanel from "./_panels/MateriAjarPanel";

type Tab = "modules" | "materi";

export default function AdminModulesPage() {
  const [tab, setTab] = useState<Tab>("modules");

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Modul</h1>
        <p className={styles.subtitle}>
          Kelola modul pembelajaran beserta materi ajarnya berdasarkan lokasi
          belajar, fase, dan pekan.
        </p>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === "modules" ? styles.tabActive : ""}`}
          onClick={() => setTab("modules")}
        >
          Daftar Modul
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === "materi" ? styles.tabActive : ""}`}
          onClick={() => setTab("materi")}
        >
          Materi Ajar
        </button>
      </div>

      {tab === "modules" ? <ModulesPanel /> : <MateriAjarPanel />}
    </div>
  );
}
