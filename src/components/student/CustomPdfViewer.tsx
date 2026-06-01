"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, Loader2, AlertCircle } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CustomPdfViewerProps {
  fileUrl: string;
}

export default function CustomPdfViewer({ fileUrl }: CustomPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>();

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Kurangi padding agar PDF tidak menempel ke tepi
        setContainerWidth(entry.contentRect.width - 32); 
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages || 1));

  return (
    <div
      className={`bg-slate-100 flex flex-col overflow-hidden border border-slate-200 shadow-inner transition-all ${
        isFullScreen ? "fixed inset-0 z-50 rounded-none" : "rounded-2xl h-[70vh] min-h-[600px]"
      }`}
    >
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex flex-wrap gap-3 items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <span className="text-xs sm:text-sm font-bold text-slate-700 min-w-[80px] sm:min-w-[120px] text-center bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200">
            Hal {pageNumber} <span className="text-slate-400 font-medium">dari {numPages || "?"}</span>
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={zoomOut} className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors">
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-xs sm:text-sm font-bold text-slate-700 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn} className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors">
            <ZoomIn className="h-5 w-5" />
          </button>

          <div className="w-px h-8 bg-slate-200 mx-1 sm:mx-3" />

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors bg-white border border-slate-200 shadow-sm"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </div>
      </div>

      {/* PDF Container */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-4 custom-scrollbar">
        {/* Wrapper min-w-max diperlukan agar saat di-zoom, konten tidak terpotong (scrolling bug di flex center) */}
        <div className="flex justify-center min-w-max min-h-full items-start">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center text-slate-500 h-64 w-full">
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-gsb-green" />
                <p className="font-bold text-sm text-slate-600">Memproses Dokumen...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center text-slate-500 h-64 w-full">
                <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <p className="font-bold text-base text-slate-900 mb-1">Gagal memuat dokumen</p>
                <p className="font-medium text-sm text-slate-500">File PDF mungkin rusak atau akses ditolak.</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={containerWidth ? Math.min(containerWidth, 1000) * scale : undefined}
              className="shadow-xl mb-6 bg-white overflow-hidden rounded-md"
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={
                <div className="flex justify-center items-center h-[800px] w-full max-w-[800px] bg-white shadow-xl rounded-md animate-pulse">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
              }
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
