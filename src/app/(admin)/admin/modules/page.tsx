"use client";

import { useState } from "react";
import styles from "./modules.module.css";
import ModulesPanel from "./_panels/ModulesPanel";
import SubjectsPanel from "./_panels/SubjectsPanel";

type Tab = "modules" | "subjects";

export default function AdminModulesPage() {
  const [tab, setTab] = useState<Tab>("modules");

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Materi Ajar</h1>
        <p className={styles.subtitle}>
          Kelola materi pembelajaran berdasarkan lokasi belajar, fase, dan mata pelajaran
        </p>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === "modules" ? styles.tabActive : ""}`}
          onClick={() => setTab("modules")}
        >
          Daftar PPT Ajar
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === "subjects" ? styles.tabActive : ""}`}
          onClick={() => setTab("subjects")}
        >
          Mata Pelajaran (berpekan)
        </button>
      </div>

      {tab === "modules" ? <ModulesPanel /> : <SubjectsPanel />}
    </div>
  );
}
