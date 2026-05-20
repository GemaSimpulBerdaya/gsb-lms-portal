"use client";

import React, { useState, useEffect } from "react";
import { getCurrentSemester, formatSemester } from "@/utils/formatters";

interface SemesterFilterProps {
  schedules: Array<{ semester: string; _id: string }>;
  onChange?: (semester: string) => void;
  onAvailabilityChange?: (semesters: string[]) => void;
  showLabel?: boolean;
}

export default function SemesterFilter({ 
  schedules, 
  onChange, 
  onAvailabilityChange,
  showLabel = true 
}: SemesterFilterProps) {
  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });

  const availableSemesters = Array.from(
    new Set([...schedules.map((s) => s.semester), getCurrentSemester()])
  )
    .filter(Boolean)
    .sort()
    .reverse();

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", selectedSemester);
    }
    if (onChange) onChange(selectedSemester);
  }, [selectedSemester, onChange]);

  useEffect(() => {
    if (onAvailabilityChange) onAvailabilityChange(availableSemesters);
  }, [schedules]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      {showLabel && <span style={{ fontSize: "14px", fontWeight: 600, color: "#64748b" }}>Filter Periode:</span>}
      <div style={{ position: "relative" }}>
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          style={{
            appearance: "none",
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "12px",
            padding: "9px 36px 9px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#1e293b",
            cursor: "pointer",
            outline: "none",
            fontFamily: "inherit",
            minWidth: "220px",
            transition: "all 0.2s"
          }}
        >
          {availableSemesters.map((sem) => (
            <option key={sem} value={sem}>
              {formatSemester(sem)}
            </option>
          ))}
        </select>
        <svg
          style={{
            position: "absolute",
            right: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "#94a3b8",
          }}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
