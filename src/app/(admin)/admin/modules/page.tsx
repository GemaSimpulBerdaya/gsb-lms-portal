"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./modules.module.css";
import ModulesPanel from "./_panels/ModulesPanel";
import SubCategoriesPanel from "./_panels/SubCategoriesPanel";

type Tab = "list" | "categories";

const VALID_TABS: Tab[] = ["list", "categories"];

export default function AdminModulesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const initialTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "list";
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (tab === "list") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/modules?${qs}` : "/admin/modules", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Manajemen Modul & Materi</h1>
        <p className={styles.subtitle}>
          Kelola materi pembelajaran SNBT dan kelas Offline GSB, plus sub-kategori SNBT.
        </p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${tab === "list" ? styles.tabActive : ""}`}
          onClick={() => setTab("list")}
        >
          Daftar Modul
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "categories" ? styles.tabActive : ""}`}
          onClick={() => setTab("categories")}
        >
          Sub-Kategori SNBT
        </button>
      </div>

      {tab === "list" ? <ModulesPanel /> : <SubCategoriesPanel />}
    </div>
  );
}
