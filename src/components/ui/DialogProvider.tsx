"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";

type DialogType = "alert" | "confirm";
type AlertVariant = "info" | "success" | "warning" | "error";

interface DialogOptions {
  title?: string;
  message: string | ReactNode;
  type?: DialogType;
  variant?: AlertVariant;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextValue {
  showAlert: (message: string | ReactNode, variant?: AlertVariant, title?: string) => Promise<void>;
  showConfirm: (message: string | ReactNode, title?: string, confirmText?: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  
  // To handle the promise resolution
  const [resolver, setResolver] = useState<{ resolve: (value: boolean | void) => void } | null>(null);

  const showAlert = useCallback(
    (message: string | ReactNode, variant: AlertVariant = "info", title?: string) => {
      return new Promise<void>((resolve) => {
        setOptions({
          type: "alert",
          message,
          variant,
          title: title || (variant === "error" ? "Kesalahan" : variant === "warning" ? "Peringatan" : "Informasi"),
          confirmText: "Tutup",
        });
        setIsOpen(true);
        setResolver({ resolve: resolve as (value: boolean | void) => void });
      });
    },
    []
  );

  const showConfirm = useCallback(
    (message: string | ReactNode, title: string = "Konfirmasi", confirmText: string = "Ya, Lanjutkan") => {
      return new Promise<boolean>((resolve) => {
        setOptions({
          type: "confirm",
          message,
          title,
          confirmText,
          cancelText: "Batal",
          variant: "warning",
        });
        setIsOpen(true);
        setResolver({ resolve: resolve as (value: boolean | void) => void });
      });
    },
    []
  );

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolver) resolver.resolve(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolver) {
      if (options?.type === "confirm") {
        resolver.resolve(false);
      } else {
        resolver.resolve();
      }
    }
  };

  const getIcon = () => {
    if (!options) return <Info className="text-blue-500" size={24} />;
    switch (options.variant) {
      case "success": return <CheckCircle className="text-emerald-500" size={24} />;
      case "error": return <XCircle className="text-rose-500" size={24} />;
      case "warning": return <AlertCircle className="text-amber-500" size={24} />;
      default: return <Info className="text-blue-500" size={24} />;
    }
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {isOpen && options && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-2xl shadow-xl border border-slate-100 w-[90%] max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="p-6">
              <div className="flex gap-4 items-start">
                <div className="shrink-0 p-2 bg-slate-50 rounded-full">
                  {getIcon()}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {options.title}
                  </h3>
                  <div className="text-[14px] text-slate-600 leading-relaxed">
                    {options.message}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              {options.type === "confirm" && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  {options.cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm
                  ${options.variant === "error" ? "bg-rose-500 hover:bg-rose-600" 
                  : options.variant === "warning" ? "bg-amber-500 hover:bg-amber-600"
                  : options.variant === "success" ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
