import styles from "./StudentTable.module.css";
import { useMounted } from "@/hooks/useMounted";

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
  const mounted = useMounted();

  return (
    <div className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Aktivitas Siswa Terkini</h3>
        <button className={styles.viewAll}>Lihat Semua →</button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>NAMA SISWA</th>
              <th>JENJANG</th>
              <th>PROGRES</th>
              <th>AKTIVITAS TERAKHIR</th>
              <th>AKSI</th>
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
                  <button className={styles.gradeBtn}>Input Nilai</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
