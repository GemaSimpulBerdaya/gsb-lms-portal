"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import {
  MATERI_AJAR_IMPORT_HEADERS,
  MODULE_IMPORT_HEADERS,
  mapMateriAjarImportRow,
  mapModuleImportRow,
  type LearningMaterialImportRow,
} from "@/lib/learningMaterialImport";

interface Props {
  type: "module" | "materi-ajar";
  defaultSemester?: string;
  defaultFase?: string;
  defaultSubject?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function LearningMaterialImportActions({
  type,
  defaultSemester = "",
  defaultFase = "",
  defaultSubject = "",
  className,
  buttonClassName,
  disabled = false,
  onSuccess,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const isModule = type === "module";
  const headers = isModule ? MODULE_IMPORT_HEADERS : MATERI_AJAR_IMPORT_HEADERS;

  const downloadTemplate = () => {
    const sample = isModule
      ? {
          "Judul Modul": "Pecahan Dasar",
          Slug: "pecahan-dasar",
          Deskripsi: "Modul pengenalan pecahan",
          Fase: defaultFase || "FASE A",
          "Mata Pelajaran": defaultSubject || "Mata Pelajaran",
          Bulan: "Agustus",
          Semester: defaultSemester || "2026-2",
          "Link Google Drive": "https://drive.google.com/file/d/FILE_ID/view",
          Urutan: 1,
        }
      : {
          "Judul Materi": "Slide Pecahan Dasar",
          Deskripsi: "Bahan presentasi untuk relawan",
          Fase: defaultFase || "FASE A",
          "Mata Pelajaran": defaultSubject || "Mata Pelajaran",
          Bulan: "Agustus",
          Semester: defaultSemester || "2026-2",
          "Link Google Drive": "https://docs.google.com/presentation/d/FILE_ID/edit",
        };
    const worksheet = XLSX.utils.json_to_sheet([sample], { header: headers });
    worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(header.length + 2, 16) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isModule ? "Modul" : "Materi Ajar");
    XLSX.writeFile(
      workbook,
      isModule ? "Template Import Modul.xlsx" : "Template Import Materi Ajar.xlsx",
    );
  };

  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xlsx", "xls"].includes(extension)) {
      onError("Format file harus .xlsx atau .xls.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("Ukuran file maksimal 5 MB.");
      event.target.value = "";
      return;
    }

    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames.find(
        (name) => name.trim().toLocaleLowerCase("id-ID") === (isModule ? "modul" : "materi ajar"),
      ) ?? workbook.SheetNames[0];
      const rows = sheetName
        ? XLSX.utils.sheet_to_json<LearningMaterialImportRow>(workbook.Sheets[sheetName])
        : [];
      if (rows.length === 0) throw new Error("File Excel tidak memiliki data.");
      if (rows.length > 500) throw new Error("Jumlah data impor maksimal 500 baris.");

      const mapRow = isModule ? mapModuleImportRow : mapMateriAjarImportRow;
      const items = rows.map((row, index) => {
        const item = mapRow(row);
        return {
          ...item,
          semester: item.semester || defaultSemester,
          _excelRow: typeof row.__rowNum__ === "number" ? row.__rowNum__ + 1 : index + 2,
        };
      });
      const response = await fetch(
        isModule ? "/api/admin/modules" : "/api/admin/materi-ajar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal mengimpor data.");
      onSuccess(result.message);
    } catch (error) {
      onError(error instanceof Error ? error.message : "File Excel rusak atau tidak sesuai format.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <button type="button" className={buttonClassName} onClick={downloadTemplate} disabled={disabled}>
        <Download size={14} /> Template Excel
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={importExcel}
      />
      <button
        type="button"
        className={buttonClassName}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || importing}
      >
        <FileSpreadsheet size={14} /> {importing ? "Mengimpor..." : "Import Excel"}
      </button>
    </div>
  );
}
