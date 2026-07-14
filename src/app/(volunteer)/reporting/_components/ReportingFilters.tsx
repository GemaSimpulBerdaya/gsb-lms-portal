import { MONTH_FILTERS } from "../_lib/reportingUtils";
import VolunteerFilterPanel from "@/components/volunteer/VolunteerFilterPanel/VolunteerFilterPanel";
import styles from "../report.module.css";

type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
};

type ReportingFiltersProps = {
  selectedSemester: string;
  schedules: Schedule[];
  total: number;
  monthFilter: string;
  scheduleFilter: string;
  keywordFilter: string;
  isReadOnly?: boolean;
  onMonthChange: (month: string) => void;
  onScheduleChange: (scheduleId: string) => void;
  onKeywordChange: (keyword: string) => void;
  onCreateClick?: () => void;
};

export default function ReportingFilters({
  selectedSemester,
  schedules,
  total,
  monthFilter,
  scheduleFilter,
  keywordFilter,
  isReadOnly,
  onMonthChange,
  onScheduleChange,
  onKeywordChange,
  onCreateClick,
}: ReportingFiltersProps) {
  return (
    <VolunteerFilterPanel title="Filter Laporan">
      <div className={styles.filterContainer}>
        <div className={styles.filterBar}>
        <div className={styles.filterGroup} style={{ flex: '0 0 auto', display: 'flex', gap: '16px' }}>
          <div className={styles.filterItem} style={{ flex: '0 0 auto' }}>
            <label className={styles.filterLabel}>TOTAL LAPORAN</label>
            <div className={styles.reportCountBadge}>{total} laporan</div>
          </div>
        </div>

        <div className={styles.searchWrapper}>
          <label className={styles.filterLabel} style={{ marginBottom: "6px", display: "block" }}>Bulan</label>
          <div style={{ position: "relative" }}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <select
              className={styles.searchInput}
              style={{ appearance: "none", cursor: "pointer" }}
              value={monthFilter}
              onChange={(e) => onMonthChange(e.target.value)}
            >
              {MONTH_FILTERS.map((month) => (
                <option key={month.value || "all"} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.searchWrapper}>
          <label className={styles.filterLabel} style={{ marginBottom: "6px", display: "block" }}>Jadwal Mengajar</label>
          <div style={{ position: "relative" }}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <select
              className={styles.searchInput}
              style={{ appearance: "none", cursor: "pointer" }}
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
        </div>

        <div className={styles.searchWrapper}>
          <label className={styles.filterLabel} style={{ marginBottom: "6px", display: "block" }}>Pencarian</label>
          <div style={{ position: "relative" }}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Cari..."
              value={keywordFilter}
              onChange={(e) => onKeywordChange(e.target.value)}
            />
          </div>
        </div>
        </div>

        {!isReadOnly && onCreateClick && (
          <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <button className={styles.btnPublish} onClick={onCreateClick} type="button" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', borderRadius: '10px', whiteSpace: 'nowrap', height: '42px', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Buat Laporan</span>
            </button>
          </div>
        )}
      </div>
    </VolunteerFilterPanel>
  );
}
