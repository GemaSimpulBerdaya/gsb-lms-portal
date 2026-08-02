"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, Search } from "lucide-react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import Spinner from "@/components/ui/Spinner/Spinner";
import { formatSemester, getCurrentSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import styles from "./studentPortfolios.module.css";

type Person = { _id: string; name?: string; teamName?: string; email?: string; region?: string; fase?: string; studentCode?: string };
type Schedule = { _id: string; region?: string; fase?: string; semester?: string };
type PortfolioItem = {
  _id: string;
  studentId: Person | string;
  scheduleId: Schedule | string;
  teamAccountId: Person | string;
  title: string;
  description?: string;
  semester: string;
  region: string;
  fase: string;
  fileUrl: string;
  fileUrls?: string[];
  week?: number;
  date?: string;
  createdAt: string;
};
type Option = { _id: string; name?: string; region: string; fase: string };

const photosOf = (item: PortfolioItem) => item.fileUrls?.length ? item.fileUrls : [item.fileUrl];
const populated = <T,>(value: T | string): T | null => typeof value === "string" ? null : value;

export default function AdminStudentPortfoliosPage() {
  const semesterLabels = useSemesterLabels();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [semester, setSemester] = useState(getCurrentSemester());
  const [semesters, setSemesters] = useState<string[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<{ schedules: Option[]; students: Option[] }>({ schedules: [], students: [] });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PortfolioItem | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((response) => response.ok ? response.json() : {})
      .then((data: { availableSemesters?: string[]; activeSemester?: string }) => {
        setSemesters(data.availableSemesters || []);
        if (data.activeSemester) setSemester(data.activeSemester);
      })
      .catch((error) => console.error("Gagal memuat semester", error));
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "15", semester });
      if (scheduleId) query.set("scheduleId", scheduleId);
      if (studentId) query.set("studentId", studentId);
      if (search.trim()) query.set("search", search.trim());
      const response = await fetch(`/api/admin/student-portfolios?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat karya siswa");
      setItems(data.items || []);
      setTotal(data.total || 0);
      setOptions(data.options || { schedules: [], students: [] });
    } catch (error) {
      console.error(error);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, scheduleId, search, semester, studentId]);

  useEffect(() => {
    const timer = window.setTimeout(fetchItems, 250);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  const openDetail = (item: PortfolioItem) => {
    setSelected(item);
    setPhotoIndex(0);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Karya Siswa</h1>
        <p>Pantau hasil karya siswa yang diunggah relawan pada setiap jadwal pembelajaran.</p>
      </header>

      <section className={styles.filters}>
        <label><span>Semester</span><AdminFilterSelect width="lg" value={semester} onChange={changeFilter(setSemester)} options={semesters.map((value) => ({ value, label: formatSemester(value, semesterLabels) }))} /></label>
        <label><span>Jadwal</span><AdminFilterSelect width="lg" value={scheduleId} onChange={changeFilter(setScheduleId)} placeholder="Semua jadwal" clearable clearLabel="Semua jadwal" options={options.schedules.map((option) => ({ value: option._id, label: `${option.region} — ${option.fase}` }))} /></label>
        <label><span>Siswa</span><AdminFilterSelect width="lg" value={studentId} onChange={changeFilter(setStudentId)} placeholder="Semua siswa" clearable clearLabel="Semua siswa" showSearch options={options.students.map((option) => ({ value: option._id, label: option.name || "Siswa Terhapus" }))} /></label>
        <label className={styles.searchField}><span>Cari Judul</span><div className={styles.searchBox}><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari karya..." /></div></label>
      </section>

      <div className={styles.summary}><Images size={17} /><strong>{total}</strong> karya ditemukan</div>

      {loading ? (
        <div className={styles.state}><Spinner /><p>Memuat karya siswa...</p></div>
      ) : items.length === 0 ? (
        <div className={styles.state}><Images size={30} /><p>Belum ada karya siswa sesuai filter.</p></div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Judul Karya</th>
                <th>Siswa</th>
                <th>Jadwal</th>
                <th>Pekan</th>
                <th>Tanggal</th>
                <th>Pengunggah</th>
                <th>Foto</th>
                <th>Jumlah Foto</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const student = populated<Person>(item.studentId);
                const team = populated<Person>(item.teamAccountId);
                const photos = photosOf(item);
                return (
                  <tr key={item._id}>
                    <td className={styles.titleCell}>{item.title}</td>
                    <td>{student?.name || "Siswa Terhapus"}</td>
                    <td>{item.region} {item.fase}</td>
                    <td>{item.week ? `Pekan ${item.week}` : "-"}</td>
                    <td>{item.date ? new Date(item.date).toLocaleDateString("id-ID") : "Tanggal tidak diisi"}</td>
                    <td>{team?.teamName || team?.name || team?.email || "Tim Terhapus"}</td>
                    <td>
                      <button type="button" className={styles.thumbnail} onClick={() => openDetail(item)} aria-label={`Lihat foto ${item.title}`}>
                        <Image src={photos[0]} alt="" fill sizes="64px" unoptimized />
                      </button>
                    </td>
                    <td>{photos.length} foto</td>
                    <td><button type="button" className={styles.detailBtn} onClick={() => openDetail(item)}>Lihat Detail</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination page={page} totalItems={total} itemsPerPage={15} onPageChange={setPage} />

      {selected && (() => {
        const photos = photosOf(selected);
        const student = populated<Person>(selected.studentId);
        const team = populated<Person>(selected.teamAccountId);
        return (
          <div className={styles.overlay} onClick={() => setSelected(null)}>
            <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
              <button type="button" className={styles.closeBtn} onClick={() => setSelected(null)} aria-label="Tutup">×</button>
              <div className={styles.carousel}>
                <Image src={photos[photoIndex]} alt={`${selected.title} foto ${photoIndex + 1}`} fill sizes="(max-width: 768px) 100vw, 800px" unoptimized />
                {photos.length > 1 && <>
                  <button type="button" className={`${styles.navBtn} ${styles.prev}`} onClick={() => setPhotoIndex((index) => (index - 1 + photos.length) % photos.length)} aria-label="Foto sebelumnya"><ChevronLeft /></button>
                  <button type="button" className={`${styles.navBtn} ${styles.next}`} onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)} aria-label="Foto berikutnya"><ChevronRight /></button>
                  <span className={styles.counter}>{photoIndex + 1} / {photos.length}</span>
                  <div className={styles.dots}>{photos.map((_, index) => <button key={index} type="button" className={index === photoIndex ? styles.dotActive : styles.dot} onClick={() => setPhotoIndex(index)} aria-label={`Foto ${index + 1}`} />)}</div>
                </>}
              </div>
              <div className={styles.modalBody}>
                <h2>{selected.title}</h2>
                {selected.description && <p>{selected.description}</p>}
                <dl>
                  <div><dt>Siswa</dt><dd>{student?.name || "Siswa Terhapus"}</dd></div>
                  <div><dt>Jadwal</dt><dd>{selected.region} — {selected.fase}</dd></div>
                  <div><dt>Pekan / Tanggal</dt><dd>{selected.week ? `Pekan ${selected.week}` : "-"} · {selected.date ? new Date(selected.date).toLocaleDateString("id-ID", { dateStyle: "long" }) : "Tanggal tidak diisi"}</dd></div>
                  <div><dt>Pengunggah</dt><dd>{team?.teamName || team?.name || team?.email || "Tim Terhapus"}</dd></div>
                  <div><dt>Semester</dt><dd>{formatSemester(selected.semester, semesterLabels)}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
