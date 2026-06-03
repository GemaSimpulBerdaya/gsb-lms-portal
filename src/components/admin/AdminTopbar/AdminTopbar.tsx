"use client";

import { useRouter } from "next/navigation";
import styles from "./adminTopbar.module.css";
import { useEffect, useState } from "react";

export default function AdminTopbar() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setAdminName(data.user?.name || data.user?.teamName || "Admin");
        }
      } catch {}
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
    }
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {/* Placeholder for breadcrumbs or title if needed */}
      </div>
      <div className={styles.right}>
        <div className={styles.profile}>
          <div className={styles.avatar}>{adminName.charAt(0)}</div>
          <span className={styles.name}>{adminName}</span>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
