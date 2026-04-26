import Sidebar from "@/components/Sidebar/Sidebar";
import styles from "./volunteerLayout.module.css";

export default function VolunteerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
