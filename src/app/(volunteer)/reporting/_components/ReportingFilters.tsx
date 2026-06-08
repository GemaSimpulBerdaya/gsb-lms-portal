import { formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import { MONTH_FILTERS } from "../_lib/reportingUtils";
import styles from "../report.module.css";

type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
};

type ReportingFiltersProps = {
  availableSemesters: string[];
  selectedSemester: string;
  schedules: Schedule[];
  total: number;
  monthFilter: string;
  scheduleFilter: string;
  keywordFilter: string;
  onSemesterChange: (semester: string) => void;
  onMonthChange: (month: string) => void;
  onScheduleChange: (scheduleId: string) => void;
  onKeywordChange: (keyword: string) => void;
};

export default function ReportingFilters({
  availableSemesters,
  selectedSemester,
  schedules,
  total,
  monthFilter,
  scheduleFilter,
  keywordFilter,
  onSemesterChange,
  onMonthChange,
  onScheduleChange,
  onKeywordChange,
}: ReportingFiltersProps) {
  const semesterLabels = useSemesterLabels();

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterGroup}>
        {availableSemesters.length > 1 && (
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Semester</label>
            <div style={{ position: "relative" }}>
              <select
                className={styles.searchInput}
                style={{ appearance: "none", cursor: "pointer", paddingRight: "40px", minWidth: "160px" }}
                value={selectedSemester}
                onChange={(e) => onSemesterChange(e.target.value)}
              >
                {availableSemesters.map((semester) => (
                  <option key={semester} value={semester}>{formatSemester(semester, semesterLabels)}</option>
                ))}
              </select>
              <svg style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#888" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
        )}
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>TOTAL LAPORAN</label>
          <div className={styles.reportCountBadge}>{total} laporan</div>
        </div>
      </div>

      <div className={styles.searchWrapper}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <select
          className={styles.searchInput}
          style={{ appearance: "none", cursor: "pointer", paddingLeft: "36px" }}
          value={monthFilter}
          onChange={(e) => onMonthChange(e.target.value)}
        >
          {MONTH_FILTERS.map((month) => (
            <option key={month.value || "all"} value={month.value}>{month.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.searchWrapper}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <select
          className={styles.searchInput}
          style={{ appearance: "none", cursor: "pointer", paddingLeft: "36px" }}
          value={scheduleFilter}
          onChange={(e) => onScheduleChange(e.target.value)}
        >
          <option value="">Semua Jadwal</option>
          {schedules
            .filter((schedule) => schedule.semester === selectedSemester)
            .map((schedule) => (
              <option key={schedule._id} value={schedule._id}>{schedule.region} - {schedule.fase}</option>
            ))}
        </select>
      </div>

      <div className={styles.searchWrapper}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Cari judul/deskripsi"
          value={keywordFilter}
          onChange={(e) => onKeywordChange(e.target.value)}
        />
      </div>
    </div>
  );
}
