"use client";

import Image from "next/image";
import {
  FileText,
  Download,
  ExternalLink,
  FileImage,
  Loader2,
  Eye,
} from "lucide-react";
import { useState, useEffect } from "react";
import CustomPdfViewer from "./CustomPdfViewer";

interface ModuleContentViewerProps {
  fileUrl: string | undefined;
  title: string;
}

function detectFileType(url: string): "pdf" | "image" | "office" | "external" {
  const lower = url.toLowerCase();
  
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(lower)) return "image";
  if (
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".ppt") ||
    lower.endsWith(".pptx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx")
  )
    return "office";

  if (lower.endsWith(".pdf") || lower.includes(".pdf?")) return "pdf";
  if (lower.includes("drive.google.com") || lower.includes("docs.google.com")) return "external";
  
  return "external";
}

export default function ModuleContentViewer({ fileUrl, title }: ModuleContentViewerProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [fileUrl]);

  if (!fileUrl) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
        <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-slate-800 font-bold text-base">Materi Belum Tersedia</p>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          Admin akan menambahkan materi pembelajaran untuk modul ini
        </p>
      </div>
    );
  }

  const fileType = detectFileType(fileUrl);

  // ── Image viewer ──────────────────────────────────────────
  if (fileType === "image") {
    return (
      <div className="bg-slate-50 rounded-2xl overflow-hidden shadow-inner border border-slate-200">
        <Image
          src={fileUrl}
          alt={title}
          width={1200}
          height={800}
          unoptimized
          className="w-full h-auto max-h-[70vh] object-contain mx-auto"
          onLoad={() => setLoading(false)}
        />
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-gsb-green animate-spin" />
          </div>
        )}
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex justify-between items-center shadow-sm">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-widest">
            <FileImage className="h-3.5 w-3.5" /> Gambar
          </span>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gsb-green font-bold hover:underline flex items-center gap-1"
          >
            Buka gambar <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  // ── PDF viewer ────────────────────────────────────────────
  if (fileType === "pdf") {
    return (
      <div className="flex flex-col gap-4">
        <CustomPdfViewer fileUrl={fileUrl} />
        
        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-widest ml-2">
            <FileText className="h-4 w-4" /> Dokumen PDF
          </span>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all active:scale-[0.97]"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>
    );
  }

  // ── Office documents ──────────────────────────────────────
  if (fileType === "office") {
    const ext = fileUrl.split(".").pop()?.toUpperCase();
    return (
      <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 sm:p-12 text-center shadow-sm">
        <div className="h-20 w-20 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
          <FileText className="h-10 w-10 text-blue-600" />
        </div>
        <p className="text-lg font-heading font-bold text-slate-900 mb-2">Dokumen {ext}</p>
        <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto font-medium leading-relaxed">
          File dokumen jenis ini tidak dapat ditampilkan langsung. Silakan buka di tab baru atau download untuk dipelajari.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gsb-green text-white rounded-xl text-sm font-bold hover:bg-gsb-green/90 shadow-md transition-all active:scale-[0.97]"
          >
            <Eye className="h-4 w-4" /> Buka Dokumen
          </a>
          <a
            href={fileUrl}
            download
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all active:scale-[0.97]"
          >
            <Download className="h-4 w-4" /> Download
          </a>
        </div>
      </div>
    );
  }

  // ── External link (Google Drive / Slides / URL umum) ───────────────
  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 sm:p-12 text-center shadow-sm">
      <div className="h-20 w-20 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
        <ExternalLink className="h-10 w-10 text-gsb-orange" />
      </div>
      <p className="text-lg font-heading font-bold text-slate-900 mb-2">Materi tersedia di Google Drive</p>
      <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto font-medium leading-relaxed">
        Klik tombol di bawah untuk membuka materi pembelajaran.
      </p>
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gsb-green text-white rounded-xl text-sm font-bold hover:bg-gsb-green/90 shadow-md transition-all active:scale-[0.97]"
      >
        <ExternalLink className="h-4 w-4" /> Buka Materi
      </a>
    </div>
  );
}
