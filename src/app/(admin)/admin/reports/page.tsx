"use client";

import { useState, useEffect, useCallback } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import Image from "next/image";
import { Camera, User, Calendar, MapPin, Download, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import styles from "./reports.module.css";
import { getCurrentSemester, formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import Spinner from "@/components/ui/Spinner/Spinner";

type Report = {
  _id: string;
  teamAccountId: {
    _id: string;
    name: string;
    email: string;
  };
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  photoUrls?: string[];
  location?: string;
  region?: string;
  fase?: string;
  semester: string;
  createdAt: string;
};

export default function AdminReportsPage() {
  const semesterLabels = useSemesterLabels();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });

  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);

  // Sync with localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", selectedSemester);
    }
  }, [selectedSemester]);

  // Initial sync with global semester
  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
          
          const stored = localStorage.getItem("activeSemester");
          if (data.activeSemester && !stored) {
             setSelectedSemester(data.activeSemester);
             localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };
    fetchGlobal();
  }, []);

  // Fetch reports
  const fetchReports = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: pg.toString(),
        limit: "15",
        semester: selectedSemester,
      });
      const res = await fetch(`/api/admin/reports?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports);
        setTotal(data.total);
        setPage(data.page);
      }
    } catch (err) {
      console.error("Gagal mengambil laporan:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester]);

  useEffect(() => {
    // Bungkus dalam queueMicrotask supaya setState yang dipanggil sebelum
    // await di fetchReports tidak dianggap sync setState dalam effect body
    // (React 19 warning "cascading renders").
    queueMicrotask(() => {
      fetchReports(1);
    });
  }, [fetchReports]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const reportPhotos = (report: Report) =>
    report.photoUrls?.length ? report.photoUrls : report.photoUrl ? [report.photoUrl] : [];

  const openReport = (report: Report) => {
    setActivePhotoIndex(0);
    setSelectedReport(report);
  };

  const accentColor = (id: string) => {
    const colors = ["var(--admin-primary)", "#10b981", "#f59e0b", "#8b5cf6"];
    return colors[id.charCodeAt(id.length - 1) % colors.length];
  };

  const handleExportExcel = async () => {
    if (total === 0) return;
    setExporting(true);
    try {
      const pages = Math.ceil(total / 50);
      const batches = await Promise.all(
        Array.from({ length: pages }, async (_, index) => {
          const query = new URLSearchParams({ page: String(index + 1), limit: "50", semester: selectedSemester });
          const response = await fetch(`/api/admin/reports?${query.toString()}`);
          if (!response.ok) throw new Error("Gagal mengambil data export");
          return ((await response.json()).reports ?? []) as Report[];
        }),
      );
      const rows = batches.flat().map((report) => ({
        Semester: report.semester,
        Tanggal: formatDate(report.date),
        "Tim Pengajar": report.teamAccountId?.name || "Relawan Terhapus",
        Email: report.teamAccountId?.email || "-",
        Judul: report.title,
        Deskripsi: report.description,
        "Lokasi Belajar": report.region || report.location || "-",
        Fase: report.fase || "-",
        Dokumentasi: reportPhotos(report).join("\n") || "-",
        "Dikirim Pada": new Date(report.createdAt).toLocaleString("id-ID"),
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [
        { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 30 },
        { wch: 48 }, { wch: 22 }, { wch: 18 }, { wch: 48 }, { wch: 22 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Laporan Kelas");
      XLSX.writeFile(workbook, `Laporan Kelas ${selectedSemester}.xlsx`);
    } catch (error) {
      console.error("Export laporan error:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Laporan Kelas</h1>
          <p className={styles.subtitle}>Pantau laporan kelas dan dokumentasi pembelajaran dari relawan.</p>
        </div>
      </header>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Semester</label>
          <AdminFilterSelect
            width="lg"
            value={selectedSemester}
            onChange={(v) => { setSelectedSemester(v); setPage(1); }}
            options={availableSemesters.map(sem => ({ value: sem, label: formatSemester(sem, semesterLabels) }))}
          />
        </div>
        <div className={styles.filterActions}>
          <button className={styles.exportBtn} onClick={handleExportExcel} disabled={loading || exporting || total === 0}>
            <Download size={14} />
            {exporting ? "Menyiapkan..." : "Export"}
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon}`} style={{ background: "var(--admin-surface-soft)", color: "var(--admin-primary)" }}>📊</div>
          <div className={styles.statInfo}>
            <h3>Total Laporan</h3>
            <p>{total}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon}`} style={{ background: "#ecfdf5", color: "#10b981" }}>
            <Camera size={24} />
          </div>
          <div className={styles.statInfo}>
            <h3>Dengan Dokumentasi</h3>
            <p>{reports.filter(r => reportPhotos(r).length > 0).length}</p>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat laporan...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className={styles.empty}>
            <p>Belum ada laporan masuk untuk semester ini.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tim Pengajar</th>
                <th>Subjek / Materi</th>
                <th>Deskripsi</th>
                <th className={styles.locationCol}>Lokasi Belajar</th>
                <th className={styles.faseCol}>Fase</th>
                <th>Tanggal</th>
                <th>Total Dokumentasi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={`${page}-${report._id}`} className={`${styles.tr} admin-page-row`}>
                  <td>
                    <div className={styles.volunteerInfo}>
                      <div className={styles.avatar} style={{ background: accentColor(report.teamAccountId?._id || "unknown") }}>
                        {(report.teamAccountId?.name || report.teamAccountId?.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className={styles.volunteerName}>{report.teamAccountId?.name || report.teamAccountId?.email || "Relawan Terhapus"}</span>
                        <span className={styles.volunteerEmail}>{report.teamAccountId?.email || "-"}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.reportTitle}>{report.title}</div>
                  </td>
                  <td className={styles.descriptionCol}>
                    <div className={styles.reportExcerpt}>{report.description}</div>
                  </td>
                  <td className={styles.locationCol}>
                    <span className={`${styles.tag} ${styles.tagBlue}`}>{report.region || report.location || "-"}</span>
                  </td>
                  <td className={styles.faseCol}>
                    <span className={`${styles.tag} ${styles.tagOrange}`}>{report.fase || "-"}</span>
                  </td>
                  <td>{formatDate(report.date)}</td>
                  <td>
                    {reportPhotos(report).length > 0 ? (
                      <button className={styles.photoPreviewBtn} onClick={() => openReport(report)} type="button">
                        <Image
                          src={reportPhotos(report)[0]}
                          alt="Bukti"
                          width={48}
                          height={48}
                          className={styles.thumbnail}
                          unoptimized
                        />
                        <span>{reportPhotos(report).length} foto</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.7rem", color: "#cbd5e1" }}>No Photo</span>
                    )}
                  </td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => openReport(report)}>Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.paginationFrame}>
        <AdminPagination
          page={page}
          totalItems={total}
          itemsPerPage={15}
          onPageChange={fetchReports}
        />
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReport(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setSelectedReport(null)}>✕</button>
            
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{selectedReport.title}</h2>
              <div className={styles.modalMeta}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <User size={14} /> {selectedReport.teamAccountId?.name || selectedReport.teamAccountId?.email || "Relawan"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Calendar size={14} /> {formatDate(selectedReport.date)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={14} /> {selectedReport.region || selectedReport.location || "Lokasi tidak tercatat"}
                </span>
              </div>
            </header>

            <div className={styles.modalBody}>
              {reportPhotos(selectedReport).length > 0 && (
                <div className={styles.reportCarousel}>
                  <Image
                    src={reportPhotos(selectedReport)[activePhotoIndex]}
                    alt={`Bukti Foto ${activePhotoIndex + 1}`}
                    width={800}
                    height={600}
                    sizes="(max-width: 768px) 100vw, 800px"
                    className={styles.reportImageLarge}
                    unoptimized
                  />
                  {reportPhotos(selectedReport).length > 1 && (
                    <>
                      <button
                        type="button"
                        className={`${styles.carouselBtn} ${styles.carouselPrev}`}
                        onClick={() => setActivePhotoIndex((index) => (index - 1 + reportPhotos(selectedReport).length) % reportPhotos(selectedReport).length)}
                        aria-label="Foto sebelumnya"
                      >
                        <ChevronLeft size={22} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.carouselBtn} ${styles.carouselNext}`}
                        onClick={() => setActivePhotoIndex((index) => (index + 1) % reportPhotos(selectedReport).length)}
                        aria-label="Foto berikutnya"
                      >
                        <ChevronRight size={22} />
                      </button>
                      <span className={styles.carouselCounter}>
                        {activePhotoIndex + 1} / {reportPhotos(selectedReport).length}
                      </span>
                      <div className={styles.carouselDots}>
                        {reportPhotos(selectedReport).map((_, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`${styles.carouselDot} ${index === activePhotoIndex ? styles.carouselDotActive : ""}`}
                            onClick={() => setActivePhotoIndex(index)}
                            aria-label={`Tampilkan foto ${index + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              
              <h3 className={styles.sectionTitle}>Deskripsi Kegiatan</h3>
              <p className={styles.descriptionText}>{selectedReport.description}</p>

              <div className={styles.gridInfo}>
                <div className={styles.infoItem}>
                  <label>Lokasi Belajar</label>
                  <p>{selectedReport.region || "-"}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>Fase / Kelas</label>
                  <p>{selectedReport.fase || "-"}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>Semester</label>
                  <p>{selectedReport.semester}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>Dikirim Pada</label>
                  <p>{formatDate(selectedReport.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
