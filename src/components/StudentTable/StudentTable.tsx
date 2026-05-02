import styles from "./StudentTable.module.css";
import { useState, useEffect } from "react";

export interface Student {
  id: string;
  name: string;
  course: string;
  progress: number;
  lastActive: string;
  avatar: string;
  color: string;
  region?: string;
}

interface StudentTableProps {
  students: Student[];
}

export default function StudentTable({ students }: StudentTableProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Active Students</h3>
        <button className={styles.viewAll}>View All →</button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>STUDENT NAME</th>
              <th>COURSE</th>
              <th>PROGRESS</th>
              <th>LAST ACTIVE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr
                key={s.id}
                className={mounted ? styles.rowAnim : styles.rowHidden}
                style={{ animationDelay: `${0.1 * (i + 1)}s` }}
              >
                <td>
                  <div className={styles.studentCell}>
                    <div
                      className={styles.avatar}
                      style={{ background: s.color }}
                    >
                      {s.avatar}
                    </div>
                    <div>
                      <div className={styles.studentName}>{s.name}</div>
                      <div className={styles.studentId}>{s.course} — {s.region || 'GSB'}</div>
                    </div>
                  </div>
                </td>
                <td className={styles.courseCell}>{s.course}</td>
                <td>
                  <div className={styles.progressCell}>
                    <div className={styles.progressTrackSm}>
                      <div
                        className={styles.progressFillSm}
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                    <span className={styles.progressPct}>{s.progress}%</span>
                  </div>
                </td>
                <td className={styles.lastActiveCell}>{s.lastActive}</td>
                <td>
                  <button className={styles.gradeBtn}>Grade</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
