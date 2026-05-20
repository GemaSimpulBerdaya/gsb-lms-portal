"use client";

import { useEffect, useState } from "react";

let cachedLabels: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

/**
 * Hook fetch `semesterLabels` setting (key→custom label) once per session.
 * Pakai global cache supaya gak fetch berulang dari banyak komponen filter.
 *
 * Kalau API gagal atau setting kosong → return {}, formatter fallback ke
 * derived label otomatis (`Januari - Juni 2026`).
 */
export function useSemesterLabels(): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>(cachedLabels || {});

  useEffect(() => {
    if (cachedLabels) {
      setLabels(cachedLabels);
      return;
    }

    if (!inflight) {
      inflight = fetch("/api/settings/public")
        .then((r) => (r.ok ? r.json() : { semesterLabels: {} }))
        .then((d) => {
          const v = (d?.semesterLabels && typeof d.semesterLabels === "object") ? d.semesterLabels : {};
          cachedLabels = v as Record<string, string>;
          return cachedLabels;
        })
        .catch(() => {
          cachedLabels = {};
          return cachedLabels;
        })
        .finally(() => {
          inflight = null;
        });
    }

    inflight.then((v) => setLabels(v));
  }, []);

  return labels;
}

/** Force re-fetch (panggil setelah admin save semesterLabels) */
export function invalidateSemesterLabels() {
  cachedLabels = null;
  inflight = null;
}
