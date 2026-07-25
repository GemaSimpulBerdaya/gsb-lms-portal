"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, Info } from "lucide-react";
import styles from "./Toast.module.css";
import { useMounted } from "@/hooks/useMounted";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = "success", duration = 3000, onClose }: ToastProps) {
  const mounted = useMounted();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for fade out animation
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [duration, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className={`${styles.toast} ${visible ? styles.show : ""} ${styles[type]}`}>
      <div className={styles.icon}>
        {type === "success" && <Check size={16} strokeWidth={2.5} />}
        {type === "error" && <CircleAlert size={16} strokeWidth={2.5} />}
        {type === "info" && <Info size={16} strokeWidth={2.5} />}
      </div>
      <div className={styles.message}>{message}</div>
    </div>,
    document.body
  );
}
