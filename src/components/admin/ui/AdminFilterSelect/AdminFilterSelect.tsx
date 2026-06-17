"use client";

import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/admin/ui/SearchableSelect/SearchableSelect";
import type { LucideIcon } from "lucide-react";
import styles from "./AdminFilterSelect.module.css";

type Width = "sm" | "md" | "lg" | "xl" | "fluid";

interface Props {
  options: Array<string | SearchableSelectOption>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  showSearch?: boolean;
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  width?: Width;
  className?: string;
}

export default function AdminFilterSelect({
  width = "md",
  className,
  ...props
}: Props) {
  return (
    <SearchableSelect
      {...props}
      size="sm"
      className={`${styles.filterSelect} ${styles[`w_${width}`]} ${className || ""}`}
    />
  );
}
