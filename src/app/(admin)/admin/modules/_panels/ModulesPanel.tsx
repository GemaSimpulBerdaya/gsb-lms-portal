"use client";

import { useEffect, useState, useMemo } from "react";
import ModuleTable, { ModuleItem } from "@/components/admin/ModuleTable/ModuleTable";
import ModuleModal from "@/components/admin/ModuleModal/ModuleModal";

import Toast from "@/components/toast/Toast";
import styles from "../modules.module.css";
import { formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import LearningMaterialImportActions from "@/components/admin/LearningMaterialImportActions/LearningMaterialImportActions";

/**
 * Tab "Daftar Modul" — versi sebelumnya isi /admin/modules/page.tsx.
 */
export default function ModulesPanel() {
  const semesterLabels = useSemesterLabels();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);


  // Filter States
  const [search, setSearch] = useState("");
  const [filterSub, setFilterSub] = useState("ALL"); // Subject
  const [filterLevel, setFilterLevel] = useState("ALL"); // Fase
  const [selectedSemester, setSelectedSemester] = useState("ALL");
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
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
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
          if (data.activeSemester) setSelectedSemester(data.activeSemester);
          if (data.availableLevels) setAvailableLevels(data.availableLevels);
          if (data.availableSubjects) setAvailableSubjects(data.availableSubjects);
        }
      } finally {
        setSettingsLoading(false);
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
      const matchSub = filterSub === "ALL" || m.subject === filterSub;
      const matchLevel = filterLevel === "ALL" || m.fase === filterLevel;
      const matchSem =
        selectedSemester === "ALL" || !m.semester || m.semester === selectedSemester;
      return matchSearch && matchSub && matchLevel && matchSem;
    });
  }, [modules, search, filterSub, filterLevel, selectedSemester]);

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
            <AdminFilterSelect
              value={filterLevel === "ALL" ? "" : filterLevel}
              onChange={(v) => setFilterLevel(v === "" ? "ALL" : v)}
              options={uniquePhases}
              clearable
              clearLabel="Semua Fase"
              placeholder="Semua Fase"
            />

            <AdminFilterSelect
              value={filterSub === "ALL" ? "" : filterSub}
              onChange={(v) => setFilterSub(v === "" ? "ALL" : v)}
              options={uniqueSubjects}
              clearable
              clearLabel="Semua Mata Pelajaran"
              placeholder="Semua Mata Pelajaran"
            />

            <AdminFilterSelect
              value={selectedSemester === "ALL" ? "" : selectedSemester}
              onChange={(v) => setSelectedSemester(v === "" ? "ALL" : v)}
              options={availableSemesters.map((sem) => ({
                value: sem,
                label: formatSemester(sem, semesterLabels),
              }))}
              clearable
              clearLabel="Semua Semester"
              placeholder="Semua Semester"
            />
          </div>
        </div>

        <div className={styles.resultsCount}>
          Total: <strong>{filteredModules.length}</strong> modul
        </div>
      </div>

      <LearningMaterialImportActions
        type="module"
        defaultSemester={selectedSemester === "ALL" ? "" : selectedSemester}
        defaultFase={availableLevels[0]}
        defaultSubject={availableSubjects[0]}
        className={styles.importActions}
        buttonClassName={styles.importBtn}
        disabled={loading || settingsLoading || selectedSemester === "ALL"}
        onSuccess={(message) => {
          showToast(message);
          fetchModules();
        }}
        onError={(message) => showToast(message, "error")}
      />

      <ModuleTable
        modules={filteredModules}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onAdd={handleAdd}
      />

      <ModuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        moduleToEdit={editingModule}
      />


      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
