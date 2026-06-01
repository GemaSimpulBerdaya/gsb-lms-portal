"use client";

import {
  FileText,
  Download,
  ExternalLink,
  FileImage,
  File,
  Loader2,
  AlertTriangle,
  Eye,
  Info
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import CustomPdfViewer from "./CustomPdfViewer";

interface ModuleContentViewerProps {
  fileUrl: string | undefined;
  title: string;
}

function transformUrlForIframe(url: string): string {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes("drive.google.com")) {
      // Replace /view with /preview for embedding
      return url.replace(/\/view(\?.*)?$/, "/preview$1").replace(/\/view$/, "/preview");
    }
    return url;
  } catch (e) {
    return url;
  }
}

function detectFileType(url: string): "pdf" | "image" | "office" | "unknown" {
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
  
  // Default fallback: Asumsikan semua file yang tidak terdeteksi sebagai PDF agar masuk ke CustomPdfViewer
  // CustomPdfViewer akan menangani error jika file tersebut benar-benar bukan PDF.
  return "pdf";
}

export default function ModuleContentViewer({ fileUrl, title }: ModuleContentViewerProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setError(false);
    setLoading(true);
    
    // Fallback: If loading takes more than 10 seconds, assume it might be blocked silently
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

  // ── Persistent Fallback Banner for iFrames ────────────────
  const FallbackBanner = () => (
    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Materi tidak tampil di layar?</p>
          <p className="text-xs text-slate-600 font-medium">Browser kadang memblokir tampilan dokumen di dalam halaman.</p>
        </div>
      </div>
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gsb-green text-white rounded-xl text-sm font-bold hover:bg-gsb-green/90 shadow-md transition-all active:scale-[0.97]"
      >
        <ExternalLink className="h-4 w-4" /> Buka Materi
      </a>
    </div>
  );

  // ── Image viewer ──────────────────────────────────────────
  if (fileType === "image") {
    return (
      <div className="bg-slate-50 rounded-2xl overflow-hidden shadow-inner border border-slate-200">
        <img
          src={fileUrl}
          alt={title}
          className="w-full h-auto max-h-[70vh] object-contain mx-auto"
          onLoad={() => setLoading(false)}
          onError={() => setError(true)}
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

  // ── Unknown (UploadThing URL atau URL umum) ───────────────
  return (
    <div>
      <FallbackBanner />
      <div className="bg-white rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative mb-4">
        <iframe
          ref={iframeRef}
          src={fileUrl}
          className="w-full h-[70vh] min-h-[400px]"
          title={title}
          allow="fullscreen"
          onLoad={() => setLoading(false)}
          onError={() => setError(true)}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90 backdrop-blur-sm z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-gsb-green animate-spin mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">Memuat konten...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
            <div className="text-center px-6 max-w-md">
              <div className="h-16 w-16 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <File className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-heading font-bold text-slate-900 mb-2">Konten Tidak Dapat Ditampilkan</p>
              <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
                Browser Anda memblokir tampilan materi ini. Gunakan tombol di bawah ini untuk melihat materi secara langsung.
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gsb-green text-white rounded-xl text-sm font-bold hover:bg-gsb-green/90 shadow-md transition-all active:scale-[0.97]"
              >
                <ExternalLink className="h-4 w-4" /> Buka Materi (Tab Baru)
              </a>
            </div>
          </div>
        )}
      </div>

      {!error && (
        <div className="flex justify-end mt-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 shadow-sm text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all active:scale-[0.97]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Buka di layar penuh
          </a>
        </div>
      )}
    </div>
  );
}
