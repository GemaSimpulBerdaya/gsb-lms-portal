"use client";

import { useEffect, useState, useMemo } from "react";
import ModuleTable, { ModuleItem } from "@/components/admin/ModuleTable/ModuleTable";
import ModuleModal from "@/components/admin/ModuleModal/ModuleModal";
import QuizModal from "@/components/admin/QuizModal/QuizModal";
import Toast from "@/components/toast/Toast";
import styles from "../modules.module.css";
import { formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";

const UNKNOWN_LOCATION_LABEL = "Belum ditentukan";

function getModuleLocation(module: ModuleItem) {
  return module.learningLocation || (module.programType === "SNBT" ? "Online SNBT" : UNKNOWN_LOCATION_LABEL);
}

/**
 * Tab "Daftar Modul" — versi sebelumnya isi /admin/modules/page.tsx.
 */
export default function ModulesPanel() {
  const semesterLabels = useSemesterLabels();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [activeModuleForQuiz, setActiveModuleForQuiz] = useState<ModuleItem | null>(null);

  // Filter States
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("ALL");
  const [filterSub, setFilterSub] = useState("ALL"); // Subject
  const [filterLevel, setFilterLevel] = useState("ALL"); // Fase
  const [selectedSemester, setSelectedSemester] = useState("ALL");
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  const fetchModules = async () => {
    try {
      const res = await fetch("/api/admin/modules");
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data modul", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchGlobal = async () => {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
        if (data.activeSemester) setSelectedSemester(data.activeSemester);
        if (data.availableRegions) setAvailableLocations(data.availableRegions);
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
        if (data.availableSubjects) setAvailableSubjects(data.availableSubjects);
      }
    };

    queueMicrotask(() => {
      fetchGlobal();
      fetchModules();
    });
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/modules/${id}`, { method: "DELETE" });
      if (res.ok) {
        setModules(modules.filter((m) => m._id !== id));
        showToast("Modul berhasil dihapus");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menghapus modul", "error");
      }
    } catch {
      showToast("Terjadi kesalahan koneksi", "error");
    }
  };

  const handleEdit = (mod: ModuleItem) => {
    setEditingModule(mod);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingModule(null);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    showToast(editingModule ? "Modul berhasil diperbarui" : "Modul berhasil ditambahkan");
    fetchModules();
  };

  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const matchSearch = m.title.toLowerCase().includes(search.toLowerCase());
      const location = getModuleLocation(m);
      const matchLocation = filterLocation === "ALL" || location === filterLocation;
      const matchSub = filterSub === "ALL" || m.subject === filterSub;
      const matchLevel = filterLevel === "ALL" || m.fase === filterLevel;
      const matchSem =
        selectedSemester === "ALL" || !m.semester || m.semester === selectedSemester;
      return matchSearch && matchLocation && matchSub && matchLevel && matchSem;
    });
  }, [modules, search, filterLocation, filterSub, filterLevel, selectedSemester]);

  const uniqueLocations = useMemo(() => {
    const activeLocations = modules
      .map(getModuleLocation)
      .filter((location): location is string => Boolean(location));
    return Array.from(new Set([...availableLocations, ...activeLocations]))
      .sort((a, b) => a.localeCompare(b));
  }, [modules, availableLocations]);

  const uniqueSubjects = useMemo(() => {
    const activeSubjects = modules.map(m => m.subject).filter((s): s is string => Boolean(s));
    return Array.from(new Set([...availableSubjects, ...activeSubjects]))
      .sort((a, b) => a.localeCompare(b));
  }, [modules, availableSubjects]);

  const uniquePhases = useMemo(() => {
    const activePhases = modules.map((m) => m.fase).filter((f): f is string => Boolean(f));
    return Array.from(new Set([...availableLevels, ...activePhases]))
      .sort((a, b) => a.localeCompare(b));
  }, [modules, availableLevels]);

  const handleOpenQuiz = (mod: ModuleItem) => {
    setActiveModuleForQuiz(mod);
    setIsQuizModalOpen(true);
  };

  const handleQuizSuccess = () => {
    showToast("Kuis berhasil disimpan");
    fetchModules();
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat data modul...</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.leftTools}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Cari judul modul..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <select
              className={styles.filterSelect}
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setFilterSub("ALL");
                setFilterLevel("ALL");
              }}
            >
              <option value="ALL">Semua Lokasi Belajar</option>
              {uniqueLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
            >
              <option value="ALL">Semua Fase</option>
              {uniquePhases.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filterSub}
              onChange={(e) => setFilterSub(e.target.value)}
            >
              <option value="ALL">Semua Mata Pelajaran</option>
              {uniqueSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <option value="ALL">Semua Semester</option>
              {availableSemesters.map((sem) => (
                <option key={sem} value={sem}>
                  {formatSemester(sem, semesterLabels)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.resultsCount}>
          Total: <strong>{filteredModules.length}</strong> modul
        </div>
      </div>

      <ModuleTable
        modules={filteredModules}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onAdd={handleAdd}
        onQuiz={handleOpenQuiz}
      />

      <ModuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        moduleToEdit={editingModule}
      />

      {activeModuleForQuiz && (
        <QuizModal
          isOpen={isQuizModalOpen}
          onClose={() => setIsQuizModalOpen(false)}
          onSuccess={handleQuizSuccess}
          module={activeModuleForQuiz}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
