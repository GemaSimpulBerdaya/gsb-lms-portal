"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./semesters.module.css";
import SemestersPanel from "./_panels/SemestersPanel";
import RegionsPanel from "./_panels/RegionsPanel";

type Tab = "semester" | "lokasi-belajar";

const VALID_TABS: Tab[] = ["semester", "lokasi-belajar"];

function normalizeTabParam(value: string | null): Tab {
  if (value === "wilayah") return "lokasi-belajar";
  return value && VALID_TABS.includes(value as Tab) ? (value as Tab) : "semester";
}

export default function SemestersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: Tab = normalizeTabParam(searchParams.get("tab"));
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
          <h1 className={styles.title}>Semester & Lokasi Belajar</h1>
          <p className={styles.subtitle}>
            Kelola timeline semester dan daftar lokasi belajar operasional dalam satu tempat.
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
          className={`${styles.tabBtn} ${tab === "lokasi-belajar" ? styles.tabActive : ""}`}
          onClick={() => setTab("lokasi-belajar")}
        >
          Lokasi Belajar & Fase
        </button>
      </div>

      {tab === "semester" ? <SemestersPanel /> : <RegionsPanel />}
    </div>
  );
}
