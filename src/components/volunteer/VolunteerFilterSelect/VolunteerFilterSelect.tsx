"use client";

import SearchableSelect from "@/components/admin/ui/SearchableSelect/SearchableSelect";
import type { LucideIcon } from "lucide-react";
import styles from "./VolunteerFilterSelect.module.css";

export type VolunteerFilterOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type VolunteerFilterSelectProps = {
  options: VolunteerFilterOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  showSearch?: boolean;
  className?: string;
};

/**
 * Dropdown filter standar untuk portal relawan.
 *
 * Sengaja dipisahkan dari filter admin supaya style dan pengembangannya
 * tidak saling memengaruhi. Daftar panjang otomatis memiliki pencarian dan
 * area scroll, sehingga tidak memakai popup native browser yang kepanjangan.
 */
export default function VolunteerFilterSelect({
  options,
  value,
  onChange,
  placeholder = "— Pilih —",
  icon,
  disabled = false,
  showSearch,
  className,
}: VolunteerFilterSelectProps) {
  return (
    <div className={`${styles.control} ${className || ""}`}>
      <SearchableSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        icon={icon}
        disabled={disabled}
        showSearch={showSearch}
        size="sm"
      />
    </div>
  );
}
