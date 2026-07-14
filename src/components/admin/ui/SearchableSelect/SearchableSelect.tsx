"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./SearchableSelect.module.css";

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  /** Daftar option. Bisa array string (auto-mapped jadi {value:s, label:s}) atau array {value, label}. */
  options: Array<string | SearchableSelectOption>;
  /** Value yang dipilih (string). Empty string = "belum dipilih". */
  value: string;
  onChange: (value: string) => void;
  /** Placeholder pas value kosong. */
  placeholder?: string;
  /** Icon kiri (lucide). */
  icon?: LucideIcon;
  /** Hide search bar (kalau option-nya sedikit, mis. <6). Default: auto (>= 6 = show). */
  showSearch?: boolean;
  /** Allow clearing ke "" (mis. utk filter "Semua"). Default false. */
  clearable?: boolean;
  /** Label untuk opsi clear. Default "— Semua —". */
  clearLabel?: string;
  /** Required attribute (utk submit form HTML). */
  required?: boolean;
  disabled?: boolean;
  /** Variant compact untuk filter row. */
  size?: "default" | "sm";
  className?: string;
}

function normalizeOptions(opts: Array<string | SearchableSelectOption>): SearchableSelectOption[] {
  return opts.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "— Pilih —",
  icon: Icon,
  showSearch,
  clearable = false,
  clearLabel = "— Semua —",
  required = false,
  disabled = false,
  size = "default",
  className,
}: Props) {
  const normalized = useMemo(() => normalizeOptions(options), [options]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [popupRect, setPopupRect] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "below" | "above";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  // Auto-decide showSearch jika tidak di-pass: tampilkan kalau >= 6 option.
  const useSearch = showSearch ?? normalized.length >= 6;

  // Render trigger dengan class style yg berbeda kalau dia di module table
  const isSubjectOrPhase = placeholder?.includes("Fase") || placeholder?.includes("Mata Pelajaran");

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return normalized;
    const q = query.toLowerCase();
    return normalized.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalized, query]);

  const selected = normalized.find((o) => o.value === value) || null;

  /** Hitung posisi popup berdasar bounding rect trigger. */
  const computePopupRect = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    if (rect.top === 0 && rect.bottom === 0) return; // Belum render di modal
    
    // Perkiraan tinggi popup (search input + list)
    const POPUP_HEIGHT = 290;
    
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Default kita mau muncul ke bawah
    let placement: "below" | "above" = "below";
    
    // Kalau ke bawah ngga muat, dan ruang di atas CUKUP buat popup, lempar ke atas
    if (spaceBelow < POPUP_HEIGHT && spaceAbove >= POPUP_HEIGHT) {
      placement = "above";
    }

    // Tapi, kalau di dalam modal, kadang dua-duanya kurang. Kita paksa ke bawah aja trus auto-scroll.
    if (placement === "below" && spaceBelow < POPUP_HEIGHT) {
      // Tunggu layout paint beres baru di scroll, kalau gak kadang gak ngaruh karena modal masih transisi
      setTimeout(() => {
        const scrollParent = getScrollParent(trigger);
        if (scrollParent) {
          const shortfall = POPUP_HEIGHT - spaceBelow + 30; // Kasih nafas 30px
          scrollParent.scrollBy({ top: shortfall, behavior: "smooth" });
        }
      }, 50);
    }

    const viewportPadding = 8;
    const popupWidth = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const popupLeft = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - popupWidth - viewportPadding
    );

    setPopupRect({
      top: placement === "below" ? rect.bottom + 4 : rect.top - 4,
      left: popupLeft,
      width: popupWidth,
      placement,
    });
  };

  // Helper untuk mencari div ber-scroll (modal body)
  function getScrollParent(node: HTMLElement | null): HTMLElement | null {
    if (!node) return null;
    if (node === document.body || node === document.documentElement) return null;
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const isScrollable = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (isScrollable && node.scrollHeight > node.clientHeight) return node;
    return getScrollParent(node.parentElement);
  }


  // Recalc posisi tiap kali popup buka, dan saat scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    
    computePopupRect();
    
    // Tunggu sedikit agar animasi/modal render sempurna sebelum kalkulasi ulang
    const timer = setTimeout(() => {
      computePopupRect();
    }, 10);
    const timer2 = setTimeout(() => {
      computePopupRect();
    }, 50);
    
    const handle = () => computePopupRect();
    // Gunakan passive: true agar scroll lancar, dan capture: true agar mendeteksi semua elemen yg di scroll.
    window.addEventListener("scroll", handle, { capture: true, passive: true });
    window.addEventListener("resize", handle);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener("scroll", handle, { capture: true });
      window.removeEventListener("resize", handle);
    };
  }, [open]);

  // Click-outside close (cek both trigger dan popup)
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(t) &&
        popupRef.current &&
        !popupRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open && useSearch) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    if (!open) {
      setQuery("");
      setHighlightIdx(0);
    }
  }, [open, useSearch]);

  const handleSelect = (v: string) => {
    if (normalized.find((option) => option.value === v)?.disabled) return;
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const totalItems = filtered.length + (clearable ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (clearable && highlightIdx === 0) {
        handleSelect("");
      } else {
        const idx = clearable ? highlightIdx - 1 : highlightIdx;
        const opt = filtered[idx];
        if (opt) handleSelect(opt.value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const popup = open && mounted ? (
    <div
      ref={popupRef}
      className={styles.popup}
      role="listbox"
      style={{
        position: "fixed",
        top: popupRect?.placement === "below" ? popupRect.top : undefined,
        bottom: popupRect?.placement === "above" ? window.innerHeight - popupRect.top + 4 : undefined,
        left: popupRect?.left ?? 0,
        width: popupRect?.width ?? "auto",
        visibility: popupRect ? "visible" : "hidden",
        opacity: popupRect ? 1 : 0,
      }}
    >
      {useSearch && (
        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            placeholder="Cari..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIdx(clearable ? 1 : 0);
            }}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Hapus pencarian"
            >
              <X size={11} />
            </button>
          )}
        </div>
      )}

      <ul className={styles.list}>
        {clearable && (
          <li
            role="option"
            aria-selected={value === ""}
            className={`${styles.option} ${styles.optionClear} ${
              value === "" ? styles.optionActive : ""
            } ${highlightIdx === 0 ? styles.optionHighlight : ""}`}
            onClick={() => handleSelect("")}
            onMouseEnter={() => setHighlightIdx(0)}
          >
            {clearLabel}
          </li>
        )}
        {filtered.length === 0 ? (
          <li className={styles.empty}>
            {query ? `Tidak ada hasil untuk "${query}"` : "Tidak ada pilihan"}
          </li>
        ) : (
          filtered.map((opt, idx) => {
            const realIdx = clearable ? idx + 1 : idx;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={opt.disabled || undefined}
                className={`${styles.option} ${
                  opt.value === value ? styles.optionActive : ""
                } ${realIdx === highlightIdx ? styles.optionHighlight : ""} ${
                  opt.disabled ? styles.optionDisabled : ""
                }`}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                onMouseEnter={() => !opt.disabled && setHighlightIdx(realIdx)}
              >
                <span>{opt.label}</span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div
      className={`${styles.wrap} ${size === "sm" ? styles.wrapSm : ""} ${className || ""}`}
    >
      {/* Hidden input untuk HTML form validation (required) */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      )}

      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${isSubjectOrPhase && size !== "sm" ? styles.triggerModal : ""} ${size === "sm" ? styles.triggerSm : ""} ${
          open ? styles.open : ""
        } ${disabled ? styles.disabled : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {Icon && <Icon size={size === "sm" ? 14 : 16} className={styles.leftIcon} />}
        <span
          className={`${styles.triggerText} ${!selected ? styles.placeholderText : ""}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={size === "sm" ? 14 : 16}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </button>

      {/* Popup dirender via portal ke <body> biar lepas dari stacking context parent. */}
      {popup && createPortal(popup, document.body)}
    </div>
  );
}
