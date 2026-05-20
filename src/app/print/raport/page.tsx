"use client";

/**
 * Halaman print raport — standalone, tanpa sidebar/modal.
 *
 * Flow:
 *  - UI di /admin/grades membuka URL ini di tab baru untuk preview atau download.
 *  - Halaman ini fetch data 1 siswa via /api/admin/grades?studentId=...&semester=...
 *  - Render `RaportContent` full-page + bar kontrol (Kembali/Unduh PDF).
 *  - Jika query `?auto=1`, otomatis trigger window.print() setelah data siap.
 *
 * CSS print di RaportContent.module.css memastikan setiap `.page` pecah
 * menjadi 1 halaman A4 dan dekorasi (warna, badge, bubble) ikut ter-print.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RaportContent, {
  type RaportStudent,
} from "@/components/admin/Raport/RaportContent";
import styles from "./print.module.css";

type GradesResponse = {
  semester: string;
  data: RaportStudent[];
};

function PrintRaportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const semester = searchParams.get("semester") || "";
  const auto = searchParams.get("auto") === "1";

  const [student, setStudent] = useState<RaportStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Aktifkan mode print di <html> supaya CSS print bisa pakai `html.printMode`
  useEffect(() => {
    document.documentElement.classList.add("printMode");
    return () => document.documentElement.classList.remove("printMode");
  }, []);

  // Fetch data siswa
  useEffect(() => {
    if (!studentId || !semester) {
      const timer = setTimeout(() => {
        setError("Parameter studentId dan semester wajib diisi.");
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    (async () => {
      try {
        const query = new URLSearchParams({ semester, studentId });
        const res = await fetch(`/api/admin/grades?${query.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const body: GradesResponse = await res.json();
        if (cancelled) return;
        const found = body.data.find((s) => s._id === studentId);
        if (!found) {
          setError("Siswa tidak ditemukan untuk semester ini.");
        } else {
          setStudent(found);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal memuat data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, semester]);

  // Auto-trigger print dialog setelah data siap (mode "Unduh PDF")
  useEffect(() => {
    if (!auto || !student) return;
    // Delay tipis supaya font + gambar sempat layout
    const timer = window.setTimeout(() => {
      window.print();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [auto, student]);

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => {
            if (window.history.length > 1) router.back();
            else window.close();
          }}
        >
          ← Kembali
        </button>
        <div className={styles.toolbarTitle}>
          {student ? `Raport ${student.name} · ${semester}` : "Raport"}
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handlePrint}
          disabled={!student}
        >
          📥 Unduh PDF
        </button>
      </div>

      {loading && <div className={styles.state}>Memuat raport…</div>}
      {error && <div className={styles.stateError}>{error}</div>}
      {student && (
        <RaportContent student={student} semester={semester} clean />
      )}
    </div>
  );
}

export default function PrintRaportPage() {
  return (
    <Suspense
      fallback={<div className={styles.state}>Memuat raport…</div>}
    >
      <PrintRaportInner />
    </Suspense>
  );
}
