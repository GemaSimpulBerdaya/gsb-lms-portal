"use client";

import { useState, useEffect } from "react";
import styles from "./input-grade.module.css";
import { useRouter } from "next/navigation";

/* ─── Types ─── */
type GradeStatus = "lulus" | "tidak_lulus" | "belum";

type StudentGrade = {
  no: number;
  id?: string;
  name: string;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarColor?: string;
  nilaiKuis: number | null;
  nilaiTugas: number | null;
  status: GradeStatus;
};

/* ─── Data ─── */
const initialStudents: StudentGrade[] = [
  {
    no: 1,
    name: "Budi Santoso",
    avatarUrl: "https://i.pravatar.cc/150?img=11",
    nilaiKuis: 85,
    nilaiTugas: 90,
    status: "lulus",
  },
  {
    no: 2,
    name: "Siti Aminah",
    avatarUrl: "https://i.pravatar.cc/150?img=5",
    nilaiKuis: 60,
    nilaiTugas: 65,
    status: "tidak_lulus",
  },
  {
    no: 3,
    name: "Ahmad Wijaya",
    avatarInitials: "AW",
    avatarColor: "#E8A838",
    nilaiKuis: null,
    nilaiTugas: null,
    status: "belum",
  },
];

/* ─── Nav Items ─── */
const navItems = [
  {
        label: "Dashboard",
         path: "/dashboard",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        ),
    },
    {
        label: "Students",
         path: "/students",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        ),
    },
    {
        label: "Input Grade",
        path: "/input-grade",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        ),
    },
    {
        label: "Report",
         path: "/reporting",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        ),
    },
    {
        label: "Schedule",
        path: "/schedule",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        ),
    },
    ];

/* ─── Status helpers ─── */
function StatusBadge({ status }: { status: GradeStatus }) {
  if (status === "lulus")
    return (
      <span className={`${styles.statusBadge} ${styles.statusLulus}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Lulus
      </span>
    );
  if (status === "tidak_lulus")
    return (
      <span className={`${styles.statusBadge} ${styles.statusTidakLulus}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        Tidak Lulus
      </span>
    );
  return (
    <span className={`${styles.statusBadge} ${styles.statusBelum}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      Belum Dinilai
    </span>
  );
}

/* ─── Page ─── */
export default function InputGradePage() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Input Nilai");
  const [mounted, setMounted] = useState(false);
  const [students, setStudents] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ region: "", level: "", module: "" });
  
  const emptyForm = { name:"", nilaiKuis:"", nilaiTugas:"", status:"belum" as GradeStatus };
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentGrade|null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentGrade|null>(null);
  const [viewTarget, setViewTarget] = useState<StudentGrade|null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Fetch students from API when filters change
  useEffect(() => {
    const fetchStudents = async () => {
      if (!filters.region || !filters.level) return;
      
      setLoading(true);
      try {
        const res = await fetch(`/api/volunteer/students?region=${filters.region}&level=${filters.level}`);
        const data = await res.json();
        
        if (data.students) {
          const formatted = data.students.map((s: any, i: number) => ({
            no: i + 1,
            id: s._id,
            name: s.name,
            avatarInitials: s.name.slice(0, 2).toUpperCase(),
            avatarColor: "#4A90E2",
            nilaiKuis: null, // Should fetch existing scores if needed
            nilaiTugas: null,
            status: "belum"
          }));
          setStudents(formatted);
        }
      } catch (error) {
        console.error("Gagal mengambil data siswa:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [filters.region, filters.level]);

  const upd = (k:string, v:string) => setForm(f=>({...f,[k]:v}));
  const openAdd = () => { setForm(emptyForm); setAddOpen(true); };
  const openEdit = (s:StudentGrade) => { setForm({name:s.name,nilaiKuis:s.nilaiKuis?.toString()??'',nilaiTugas:s.nilaiTugas?.toString()??'',status:s.status}); setEditTarget(s); };
  const closeModal = () => { setAddOpen(false); setEditTarget(null); };
  
  const handleSave = async () => {
    const kuis = form.nilaiKuis ? Number(form.nilaiKuis) : null;
    const tugas = form.nilaiTugas ? Number(form.nilaiTugas) : null;
    
    // If editing local state (still keep for UI feedback)
    if (editTarget) {
      setStudents(p=>p.map(s=>s.no===editTarget.no?{...s,name:form.name,nilaiKuis:kuis,nilaiTugas:tugas,status:form.status}:s));
      
      // Save to API if student has an ID
      if ((editTarget as any).id) {
        try {
          if (kuis !== null) {
            await fetch('/api/volunteer/evaluation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                anakDidikId: (editTarget as any).id,
                type: "KUIS",
                score: kuis,
                semester: "2025-Ganjil", // Hardcoded for demo
                notes: form.name + " - Kuis"
              })
            });
          }
          if (tugas !== null) {
            await fetch('/api/volunteer/evaluation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                anakDidikId: (editTarget as any).id,
                type: "TUGAS",
                week: 1, // Hardcoded for demo
                score: tugas,
                semester: "2025-Ganjil",
                notes: form.name + " - Tugas"
              })
            });
          }
          alert("Nilai berhasil disimpan ke database!");
        } catch (e) {
          console.error("Gagal simpan ke API:", e);
        }
      }
    } else {
      const no = students.length+1;
      setStudents(p=>[...p,{no,name:form.name,avatarInitials:form.name.slice(0,2).toUpperCase(),avatarColor:'#4A90D9',nilaiKuis:kuis,nilaiTugas:tugas,status:form.status}]);
    }
    closeModal();
  };
  const handleDelete = () => { if(deleteTarget){ setStudents(p=>p.filter(s=>s.no!==deleteTarget.no).map((s,i)=>({...s,no:i+1}))); setDeleteTarget(null); } };

  return (
    <div className={styles.container}>

      {/* ── SIDEBAR ── */}
      <aside className={`${styles.sidebar} ${mounted ? styles.sidebarEnter : ""}`}>
        <div>
          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.brandAvatarPlaceholder}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className={styles.brandText}>
              <p className={styles.brandName}>GSB LMS</p>
              <p className={styles.brandSub}>Volunteer Portal</p>
            </div>
          </div>

          {/* New Session Button */}
          <button className={styles.btnNewSession}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Session</span>
          </button>

          {/* Nav */}
          <nav className={styles.menu}>
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`${styles.menuItem} ${activeNav === item.label ? styles.menuItemActive : ""}`}
                onClick={() => {
                  setActiveNav(item.label);
                  router.push(item.path);
                }}
              >
                <span className={styles.menuIcon}>{item.icon}</span>
                <span className={styles.menuLabel}>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom */}
        <div className={styles.bottomMenu}>
          <button className={styles.menuItem}>
            <span className={styles.menuIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span className={styles.menuLabel}>Settings</span>
          </button>
        </div>
      </aside>

      {/* ── RIGHT COLUMN (TopBar + Main) ── */}
      <div className={styles.rightColumn}>

        {/* Top Bar */}
        <div className={styles.topBar}>
          <span className={styles.topBarTitle}>Volunteer Dashboard</span>
          <div className={styles.topBarRight}>
            {/* Search */}
            <div className={styles.searchBarWrapper}>
              <svg className={styles.searchBarIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className={styles.searchBar}
                placeholder="Search students..."
              />
            </div>

            {/* Bell */}
            <button className={styles.iconBtn} aria-label="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

            {/* Help */}
            <button className={styles.iconBtn} aria-label="Help">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>

            {/* User Avatar */}
            <div className={styles.userAvatar}>S</div>
          </div>
        </div>

        {/* Main */}
        <main className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>

          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Input Nilai Siswa</h1>
            <p className={styles.pageDesc}>
              Perbarui nilai akademik siswa untuk evaluasi berkala. Pastikan data yang
              dimasukkan akurat sebelum menyimpan.
            </p>
          </div>

          {/* Filter Bar */}
          <div className={styles.filterCard}>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Wilayah</label>
              <div className={styles.selectWrapper}>
                <select 
                  className={styles.filterSelect} 
                  value={filters.region}
                  onChange={(e) => setFilters(p => ({ ...p, region: e.target.value }))}
                >
                  <option value="" disabled>Pilih Wilayah</option>
                  <option value="Jakarta Selatan">Jakarta Selatan</option>
                  <option value="Depok">Depok</option>
                  <option value="Bekasi">Bekasi</option>
                  <option value="Tangerang">Tangerang</option>
                  <option value="Jakarta Timur">Jakarta Timur</option>
                </select>
                <svg className={styles.chevronIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Tingkat</label>
              <div className={styles.selectWrapper}>
                <select 
                  className={styles.filterSelect} 
                  value={filters.level}
                  onChange={(e) => setFilters(p => ({ ...p, level: e.target.value }))}
                >
                  <option value="" disabled>Pilih Tingkat</option>
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="TK">TK</option>
                  <option value="DISABILITAS">DISABILITAS</option>
                </select>
                <svg className={styles.chevronIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Modul Pembelajaran</label>
              <div className={styles.selectWrapper}>
                <select className={styles.filterSelect} defaultValue="">
                  <option value="" disabled>Pilih Modul</option>
                  <option>Matematika Dasar</option>
                  <option>Bahasa Indonesia</option>
                  <option>Sains Terapan</option>
                  <option>Literasi Digital</option>
                </select>
                <svg className={styles.chevronIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div>
                <h2 className={styles.tableCardTitle}>Daftar Siswa</h2>
                <span className={styles.foundBadge}>{students.length} Siswa Ditemukan</span>
              </div>
              <button className={styles.btnTambah} onClick={openAdd}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Tambah Siswa
              </button>
            </div>

            <table className={styles.gradeTable}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Siswa</th>
                  <th>Nilai Kuis</th>
                  <th>Nilai Tugas</th>
                  <th>Status</th>
                  <th style={{textAlign:'center'}}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                      Memuat data siswa...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                      Silakan pilih Wilayah dan Tingkat untuk melihat daftar siswa.
                    </td>
                  </tr>
                ) : (
                  students.map((s, i) => (
                  <tr
                    key={s.no}
                    className={
                      mounted
                        ? styles[`rowAnim${i + 1}` as keyof typeof styles]
                        : styles.rowHidden
                    }
                  >
                    {/* No */}
                    <td className={styles.cellNo}>{s.no}</td>

                    {/* Nama Siswa */}
                    <td>
                      <div className={styles.studentCell}>
                        {s.avatarUrl ? (
                          <img src={s.avatarUrl} alt={s.name} className={styles.avatarImg} />
                        ) : (
                          <div
                            className={styles.avatarInitials}
                            style={{ background: s.avatarColor ?? "#aaa" }}
                          >
                            {s.avatarInitials}
                          </div>
                        )}
                        <span className={styles.studentName}>{s.name}</span>
                      </div>
                    </td>

                    {/* Nilai Kuis */}
                    <td className={styles.cellScore}>
                      {s.nilaiKuis !== null ? (
                        <span
                          className={`${styles.scoreChip} ${
                            s.nilaiKuis < 70 ? styles.scoreChipRed : ""
                          }`}
                        >
                          {s.nilaiKuis}
                        </span>
                      ) : (
                        <span className={styles.scoreDash}>–</span>
                      )}
                    </td>

                    {/* Nilai Tugas */}
                    <td className={styles.cellScore}>
                      {s.nilaiTugas !== null ? (
                        <span
                          className={`${styles.scoreChip} ${
                            s.nilaiTugas < 70 ? styles.scoreChipRed : ""
                          }`}
                        >
                          {s.nilaiTugas}
                        </span>
                      ) : (
                        <span className={styles.scoreDash}>–</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className={styles.cellStatus}>
                      <StatusBadge status={s.status} />
                    </td>
                    {/* Aksi */}
                    <td className={styles.cellAksi}>
                      <div className={styles.actionBtns}>
                        <button className={styles.btnActionView} onClick={()=>setViewTarget(s)} title="Detail">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button className={styles.btnActionEdit} onClick={()=>openEdit(s)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className={styles.btnActionDel} onClick={()=>setDeleteTarget(s)} title="Hapus">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>

                      {/* MODAL */}
                      {(addOpen || editTarget) && (
                          <div className={styles.modalOverlay}>
                              <div className={styles.modalModern}>

                                  {/* Header */}
                                  <div className={styles.modalHeader}>
                                      <h3>
                                          {editTarget ? "Edit Siswa" : "Tambah Siswa"}
                                      </h3>
                                      <button onClick={closeModal} className={styles.modalClose}>
                                          ✕
                                      </button>
                                  </div>

                                  {/* Body */}
                                  <div className={styles.modalBody}>
                                      <div className={styles.inputGroup}>
                                          <label>Nama Siswa</label>
                                          <input
                                              value={form.name}
                                              onChange={(e) => upd("name", e.target.value)}
                                              placeholder="Contoh: Budi Santoso"
                                          />
                                      </div>

                                      <div className={styles.inputRow}>
                                          <div className={styles.inputGroup}>
                                              <label>Nilai Kuis</label>
                                              <input
                                                  type="number"
                                                  value={form.nilaiKuis}
                                                  onChange={(e) => upd("nilaiKuis", e.target.value)}
                                              />
                                          </div>

                                          <div className={styles.inputGroup}>
                                              <label>Nilai Tugas</label>
                                              <input
                                                  type="number"
                                                  value={form.nilaiTugas}
                                                  onChange={(e) => upd("nilaiTugas", e.target.value)}
                                              />
                                          </div>
                                      </div>

                                      <div className={styles.inputGroup}>
                                          <label>Status</label>
                                          <select
                                              value={form.status}
                                              onChange={(e) => upd("status", e.target.value)}
                                          >
                                              <option value="belum">Belum Dinilai</option>
                                              <option value="lulus">Lulus</option>
                                              <option value="tidak_lulus">Tidak Lulus</option>
                                          </select>
                                      </div>
                                  </div>

                                  {/* Footer */}
                                  <div className={styles.modalFooter}>
                                      <button onClick={closeModal} className={styles.btnGhost}>
                                          Batal
                                      </button>
                                      <button onClick={handleSave} className={styles.btnPrimary}>
                                          Simpan
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* ───── MODAL VIEW ───── */}
                      {viewTarget && (
                          <div className={styles.modalOverlay}>
                              <div className={styles.modalModern}>
                                  <div className={styles.modalHeader}>
                                      <h3>Detail Siswa</h3>
                                      <button onClick={() => setViewTarget(null)} className={styles.modalClose}>✕</button>
                                  </div>
                                  
                                  <div className={styles.modalBody}>
                                      <div className={styles.viewProfile}>
                                          {viewTarget.avatarUrl ? (
                                              <img src={viewTarget.avatarUrl} alt={viewTarget.name} className={styles.viewAvatar} />
                                          ) : (
                                              <div className={styles.viewAvatarInitials} style={{ background: viewTarget.avatarColor ?? "#aaa" }}>
                                                  {viewTarget.avatarInitials}
                                              </div>
                                          )}
                                          <div className={styles.viewInfo}>
                                              <h2>{viewTarget.name}</h2>
                                              <StatusBadge status={viewTarget.status} />
                                          </div>
                                      </div>
                                      
                                      <div className={styles.viewStats}>
                                          <div className={styles.statBox}>
                                              <span>Nilai Kuis</span>
                                              <strong>{viewTarget.nilaiKuis ?? "–"}</strong>
                                          </div>
                                          <div className={styles.statBox}>
                                              <span>Nilai Tugas</span>
                                              <strong>{viewTarget.nilaiTugas ?? "–"}</strong>
                                          </div>
                                          <div className={styles.statBox}>
                                              <span>Rata-rata</span>
                                              <strong>
                                                {viewTarget.nilaiKuis && viewTarget.nilaiTugas 
                                                  ? Math.round((viewTarget.nilaiKuis + viewTarget.nilaiTugas) / 2) 
                                                  : "–"}
                                              </strong>
                                          </div>
                                      </div>
                                  </div>

                                  <div className={styles.modalFooter}>
                                      <button className={styles.btnGhost} onClick={() => setViewTarget(null)}>Tutup</button>
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* ───── MODAL DELETE ───── */}
                      {deleteTarget && (
                          <div className={styles.modalOverlay}>
                              <div className={styles.modalDanger}>
                                  <div className={styles.dangerIconWrapper}>
                                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                          <line x1="12" y1="9" x2="12" y2="13"/>
                                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                                      </svg>
                                  </div>
                                  <h3>Hapus Data Siswa</h3>
                                  <p>Anda yakin ingin menghapus data <strong>{deleteTarget.name}</strong>? Tindakan ini tidak dapat dibatalkan dan semua rekaman nilai akan hilang permanen.</p>
                                  <div className={styles.dangerActions}>
                                      <button className={styles.btnGhost} onClick={() => setDeleteTarget(null)}>Batal</button>
                                      <button className={styles.btnDanger} onClick={handleDelete}>Ya, Hapus Data</button>
                                  </div>
                              </div>
                          </div>
                      )}

            {/* Footer */}
            <div className={styles.tableFooter}>
              <button className={styles.btnBatal}>Batal</button>
              <button className={styles.btnSimpan}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Simpan Nilai
              </button>
            </div>
          </div>

        </main>
      </div>

    </div>
  );
}
