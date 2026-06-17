"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import AdminStudentTable, { Student } from "@/components/admin/AdminStudentTable/AdminStudentTable";
import styles from "./students.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import { formatFaseLabel } from "@/utils/formatters";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterRegion, setFilterRegion] = useState("ALL");
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/students");
      if (res.ok) {
        const data = await res.json();
        const sortedStudents = (data.students || []).sort((a: Student, b: Student) => 
          a.name.localeCompare(b.name)
        );
        setStudents(sortedStudents);
      }
    } catch (err) {
      console.error("Gagal mengambil data siswa", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
        if (data.availableRegions) setAvailableRegions(data.availableRegions);
      }
    } catch (err) {
      console.error("Gagal mengambil pengaturan", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
      fetchSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchStudents, fetchSettings]);

  const uniqueRegions = useMemo(() => {
    const activeRegions = students.map(s => s.region).filter((reg): reg is string => Boolean(reg));
    return Array.from(new Set([...availableRegions, ...activeRegions])).sort((a, b) => a.localeCompare(b));
  }, [students, availableRegions]);

  const uniqueCategories = useMemo(() => {
    const activeLevels = students.map(s => s.fase).filter((f): f is string => Boolean(f));
    return Array.from(new Set([...availableLevels, ...activeLevels])).sort((a, b) => a.localeCompare(b));
  }, [students, availableLevels]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = filterCategory === "ALL" || s.fase === filterCategory;
      const matchRegion = filterRegion === "ALL" || s.region === filterRegion;
      return matchSearch && matchCategory && matchRegion;
    });
  }, [students, search, filterCategory, filterRegion]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat data siswa...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Daftar Siswa</h1>
        <p className={styles.subtitle}>Kelola semua data siswa GSB dari berbagai fase belajar.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.leftTools}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Cari nama siswa..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <select
              className={styles.filterSelect}
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
            >
              <option value="ALL">Semua Lokasi</option>
              {uniqueRegions.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
            
            <select
              className={styles.filterSelect}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">Semua Fase</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{formatFaseLabel(cat)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <AdminStudentTable students={filteredStudents} />
    </div>
  );
}
