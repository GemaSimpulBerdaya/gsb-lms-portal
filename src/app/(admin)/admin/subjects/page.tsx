"use client";

import styles from "../modules/modules.module.css";
import SubjectsPanel from "../modules/_panels/SubjectsPanel";

export default function AdminSubjectsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mata Pelajaran</h1>
        <p className={styles.subtitle}>
          Kelola daftar mata pelajaran yang dipakai untuk modul, jadwal KBM, dan
          pemetaan pekanan.
        </p>
      </div>

      <SubjectsPanel />
    </div>
  );
}
