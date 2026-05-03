"use client";

import { useRouter } from "next/navigation";
import styles from "./adminTopbar.module.css";
import { useEffect, useState } from "react";

export default function AdminTopbar() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setAdminName(user.name || "Admin");
      } catch (e) {}
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.replace("/");
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
