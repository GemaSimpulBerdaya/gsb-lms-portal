import AdminGuard from "@/components/admin/AdminGuard";
import AdminSidebar from "@/components/admin/AdminSidebar/AdminSidebar";
import styles from "./adminLayout.module.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className={styles.container}>
        <AdminSidebar />
        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
