"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./semesters.module.css";
import SemestersPanel from "./_panels/SemestersPanel";
import RegionsPanel from "./_panels/RegionsPanel";

type Tab = "semester" | "wilayah";

const VALID_TABS: Tab[] = ["semester", "wilayah"];

export default function SemestersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const initialTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "semester";
  const [tab, setTab] = useState<Tab>(initialTab);

  // Sinkron tab ↔ query string supaya bisa di-bookmark / di-link
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (tab === "semester") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/semesters?${qs}` : "/admin/semesters", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Semester & Wilayah</h1>
          <p className={styles.subtitle}>
            Kelola timeline semester dan daftar wilayah operasional dalam satu tempat.
          </p>
        </div>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${tab === "semester" ? styles.tabActive : ""}`}
          onClick={() => setTab("semester")}
        >
          Semester
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "wilayah" ? styles.tabActive : ""}`}
          onClick={() => setTab("wilayah")}
        >
          Wilayah & Fase
        </button>
      </div>

      {tab === "semester" ? <SemestersPanel /> : <RegionsPanel />}
    </div>
  );
}
