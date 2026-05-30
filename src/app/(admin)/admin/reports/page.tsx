"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Camera, User, Calendar, MapPin } from "lucide-react";
import styles from "./reports.module.css";
import { getCurrentSemester, formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";

type Report = {
  _id: string;
  relawanId: {
    _id: string;
    name: string;
    email: string;
  };
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  location?: string;
  region?: string;
  level?: string;
  semester: string;
  createdAt: string;
};

export default function AdminReportsPage() {
  const semesterLabels = useSemesterLabels();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
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
          if (data.activeSemester && (!stored || stored === "2025-1")) {
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
        setTotalPages(data.totalPages);
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

  const accentColor = (id: string) => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
    return colors[id.charCodeAt(id.length - 1) % colors.length];
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Laporan Kegiatan</h1>
          <p className={styles.subtitle}>Pantau aktivitas dan dokumentasi mengajar dari seluruh relawan.</p>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>Semester</label>
            <select
              className={styles.select}
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              {availableSemesters.length > 0 ? (
                availableSemesters.map(sem => (
                  <option key={sem} value={sem}>{formatSemester(sem, semesterLabels)}</option>
                ))
              ) : (
                <option value={selectedSemester}>{formatSemester(selectedSemester, semesterLabels)}</option>
              )}
            </select>
          </div>
        </div>
      </header>

      {/* Stats Quick View */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon}`} style={{ background: "#eff6ff", color: "#3b82f6" }}>📊</div>
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
            <p>{reports.filter(r => r.photoUrl).length}</p>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Memuat laporan...</div>
        ) : reports.length === 0 ? (
          <div className={styles.empty}>
            <p>Belum ada laporan masuk untuk semester ini.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Relawan</th>
                <th>Kegiatan</th>
                <th>Wilayah / Level</th>
                <th>Tanggal</th>
                <th>Bukti</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id} className={styles.tr}>
                  <td>
                    <div className={styles.volunteerInfo}>
                      <div className={styles.avatar} style={{ background: accentColor(report.relawanId?._id || "unknown") }}>
                        {(report.relawanId?.name || report.relawanId?.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className={styles.volunteerName}>{report.relawanId?.name || report.relawanId?.email || "Relawan Terhapus"}</span>
                        <span className={styles.volunteerEmail}>{report.relawanId?.email || "-"}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.reportTitle}>{report.title}</div>
                    <div className={styles.reportExcerpt}>{report.description}</div>
                  </td>
                  <td>
                    <span className={`${styles.tag} ${styles.tagBlue}`}>{report.region || "-"}</span>
                    <span className={`${styles.tag} ${styles.tagOrange}`} style={{ marginLeft: "8px" }}>{report.level || "-"}</span>
                  </td>
                  <td>{formatDate(report.date)}</td>
                  <td>
                    {report.photoUrl ? (
                      <Image
                        src={report.photoUrl}
                        alt="Bukti"
                        width={48}
                        height={48}
                        className={styles.thumbnail}
                        onClick={() => setSelectedReport(report)}
                        unoptimized
                      />
                    ) : (
                      <span style={{ fontSize: "0.7rem", color: "#cbd5e1" }}>No Photo</span>
                    )}
                  </td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => setSelectedReport(report)}>Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Placeholder */}
      {(() => {
        const pages = [];
        if (totalPages <= 7) {
          for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
          if (page <= 4) {
            pages.push(1, 2, 3, 4, 5, 'jump-next', totalPages);
          } else if (page >= totalPages - 3) {
            pages.push(1, 'jump-prev', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
          } else {
            pages.push(1, 'jump-prev', page - 1, page, page + 1, 'jump-next', totalPages);
          }
        }
        
        return (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", padding: "16px 24px", border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#64748b" }}>
              Halaman <strong style={{ color: "#0f172a" }}>{page}</strong> dari <strong style={{ color: "#0f172a" }}>{totalPages}</strong>
            </span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                onClick={() => fetchReports(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{ padding: "6px 12px", fontSize: "13px", fontWeight: "600", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 1 ? "#f1f5f9" : "#fff", color: page === 1 ? "#94a3b8" : "#334155", cursor: page === 1 ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              >
                ‹ Prev
              </button>
              
              {pages.map((p, idx) => {
                if (p === 'jump-prev' || p === 'jump-next') {
                  return (
                    <span
                      key={idx}
                      style={{ padding: "6px 4px", fontSize: "13px", color: "#94a3b8", letterSpacing: "2px" }}
                    >
                      •••
                    </span>
                  );
                }
                return (
                  <button
                    key={idx}
                    onClick={() => typeof p === 'number' && fetchReports(p)}
                    style={{ 
                      padding: "6px 12px", minWidth: "32px", fontSize: "13px", 
                      fontWeight: p === page ? "600" : "500", 
                      borderRadius: "6px", 
                      border: "1px solid", 
                      borderColor: p === page ? "#F58220" : "#e2e8f0", 
                      background: p === page ? "#F58220" : "#fff", 
                      color: p === page ? "#fff" : "#334155", 
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => fetchReports(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{ padding: "6px 12px", fontSize: "13px", fontWeight: "600", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === totalPages ? "#f1f5f9" : "#fff", color: page === totalPages ? "#94a3b8" : "#334155", cursor: page === totalPages ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              >
                Next ›
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", paddingLeft: "12px", borderLeft: "1px solid #cbd5e1" }}>
                <span style={{ fontSize: "13px", color: "#64748b" }}>Ke hal:</span>
                <select 
                  value={page} 
                  onChange={(e) => fetchReports(Number(e.target.value))}
                  style={{ padding: "4px 24px 4px 8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", appearance: "auto" }}
                >
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detail Modal */}
      {selectedReport && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReport(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button className={styles.closeModal} onClick={() => setSelectedReport(null)}>✕</button>
            
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{selectedReport.title}</h2>
              <div className={styles.modalMeta}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <User size={14} /> {selectedReport.relawanId?.name || selectedReport.relawanId?.email || "Relawan"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Calendar size={14} /> {formatDate(selectedReport.date)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={14} /> {selectedReport.location || "Lokasi tidak tercatat"}
                </span>
              </div>
            </header>

            <div className={styles.modalBody}>
              {selectedReport.photoUrl && (
                <Image
                  src={selectedReport.photoUrl}
                  alt="Bukti Foto"
                  width={800}
                  height={600}
                  sizes="(max-width: 768px) 100vw, 800px"
                  className={styles.reportImageLarge}
                  unoptimized
                />
              )}
              
              <h3 className={styles.sectionTitle}>Deskripsi Kegiatan</h3>
              <p className={styles.descriptionText}>{selectedReport.description}</p>

              <div className={styles.gridInfo}>
                <div className={styles.infoItem}>
                  <label>Wilayah</label>
                  <p>{selectedReport.region || "-"}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>Level / Kelas</label>
                  <p>{selectedReport.level || "-"}</p>
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
