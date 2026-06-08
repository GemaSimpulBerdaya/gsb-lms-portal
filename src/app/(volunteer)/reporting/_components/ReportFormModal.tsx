import type { ChangeEvent, RefObject } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import { dateToIso, formatKbmDateShort, isFutureDate } from "@/utils/formatters";
import PhotoUploadField from "./PhotoUploadField";
import styles from "../report.module.css";

type KbmDate = {
  week: number;
  date: string;
  topic?: string;
};

type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  kbmDates?: KbmDate[];
};

type ReportFormModalProps = {
  editingId: string | null;
  schedules: Schedule[];
  formScheduleId: string;
  formDate: string;
  formLocation: string;
  formTitle: string;
  formDesc: string;
  formPhotos: string[];
  submitting: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  onScheduleChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onDateChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onOpenPhotoOptions: () => void;
};

export default function ReportFormModal({
  editingId,
  schedules,
  formScheduleId,
  formDate,
  formLocation,
  formTitle,
  formDesc,
  formPhotos,
  submitting,
  fileInputRef,
  onClose,
  onSubmit,
  onScheduleChange,
  onDateChange,
  onLocationChange,
  onTitleChange,
  onDescChange,
  onFileChange,
  onRemovePhoto,
  onOpenPhotoOptions,
}: ReportFormModalProps) {
  const selectedSchedule = schedules.find((schedule) => schedule._id === formScheduleId);
  const kbmDates = selectedSchedule?.kbmDates ?? [];

  return (
    <div className={styles.previewOverlay} onClick={onClose}>
      <div className={styles.reportFormPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.reportFormHeader}>
          <div>
            <p className={styles.reportFormLabel}>LAPORAN KEGIATAN</p>
            <h2 className={styles.reportFormTitle}>{editingId ? "Edit Laporan" : "Buat Laporan Baru"}</h2>
          </div>
          <button className={styles.previewClose} onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.reportFormBody}>
          <div className={styles.reportFormRow}>
            <div className={styles.reportFormField}>
              <label className={styles.reportFormFieldLabel}>Pilih Jadwal </label>
              <select
                className={styles.reportFormInput}
                style={{ appearance: "none", cursor: "pointer" }}
                value={formScheduleId}
                onChange={onScheduleChange}
              >
                <option value="">-- Tidak Terkait Jadwal --</option>
                {schedules.map((schedule) => (
                  <option key={schedule._id} value={schedule._id}>{schedule.region} - {schedule.fase}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.reportFormRow}>
            <div className={styles.reportFormField}>
              <label className={styles.reportFormFieldLabel}>Tanggal Kegiatan <span className={styles.required}>*</span></label>
              {formScheduleId && kbmDates.length > 0 ? (
                <KbmDateSelect
                  dates={kbmDates}
                  value={formDate}
                  onChange={onDateChange}
                />
              ) : (
                <input
                  type="date"
                  className={styles.reportFormInput}
                  value={formDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  max={dateToIso(new Date())}
                />
              )}
            </div>
            <div className={styles.reportFormField}>
              <label className={styles.reportFormFieldLabel}>Lokasi Detail (Opsional)</label>
              <input
                type="text"
                className={styles.reportFormInput}
                placeholder="Contoh: SDN 01 Kebayoran Baru"
                value={formLocation}
                onChange={(e) => onLocationChange(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.reportFormField}>
            <label className={styles.reportFormFieldLabel}>Judul Laporan <span className={styles.required}>*</span></label>
            <input
              type="text"
              className={styles.reportFormInput}
              placeholder="Contoh: Kegiatan Mengajar Minggu ke-3"
              value={formTitle}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>

          <div className={styles.reportFormField}>
            <label className={styles.reportFormFieldLabel}>Deskripsi Kegiatan <span className={styles.required}>*</span></label>
            <textarea
              className={styles.reportFormTextarea}
              placeholder="Ceritakan kegiatan yang dilakukan, kendala yang dihadapi, dan perkembangan siswa..."
              value={formDesc}
              onChange={(e) => onDescChange(e.target.value)}
              rows={5}
            />
          </div>

          <PhotoUploadField
            photos={formPhotos}
            fileInputRef={fileInputRef}
            onFileChange={onFileChange}
            onRemovePhoto={onRemovePhoto}
            onOpenOptions={onOpenPhotoOptions}
          />
        </div>

        <div className={styles.reportFormFooter}>
          <button className={styles.btnCancelForm} onClick={onClose} disabled={submitting} type="button">Batal</button>
          <button className={styles.btnSubmitForm} onClick={onSubmit} disabled={submitting} type="button">
            {submitting ? (
              <><Spinner size="sm" style={{ marginRight: "6px" }} />Menyimpan...</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {editingId ? "Simpan Perubahan" : "Kirim Laporan"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function KbmDateSelect({
  dates,
  value,
  onChange,
}: {
  dates: KbmDate[];
  value: string;
  onChange: (value: string) => void;
}) {
  const sorted = [...dates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const monthFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  });
  const groups: { month: string; items: KbmDate[] }[] = [];

  for (const date of sorted) {
    const monthLabel = monthFormatter.format(new Date(date.date));
    const last = groups[groups.length - 1];
    if (last && last.month === monthLabel) {
      last.items.push(date);
    } else {
      groups.push({ month: monthLabel, items: [date] });
    }
  }

  return (
    <select
      className={styles.reportFormInput}
      style={{ appearance: "none", cursor: "pointer" }}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">-- Pilih Tanggal Pertemuan --</option>
      {groups.map((group) => (
        <optgroup key={group.month} label={group.month}>
          {group.items.map((date) => {
            const iso = dateToIso(date.date);
            const future = isFutureDate(date.date);
            return (
              <option key={`${date.week}-${iso}`} value={iso} disabled={future}>
                Pekan {date.week} - {formatKbmDateShort(date.date)}
                {future ? " - belum mulai" : ""}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}
