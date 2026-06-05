"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccessAdminArea, isAcademicRole, isAcademicAllowedPath, ACADEMIC_LANDING } from "@/lib/roles";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          router.replace("/");
          return;
        }

        const data = await res.json();
        if (!canAccessAdminArea(data.user?.role)) {
          router.replace("/dashboard");
          return;
        }

        if (isAcademicRole(data.user?.role) && !isAcademicAllowedPath(window.location.pathname)) {
          router.replace(ACADEMIC_LANDING);
          return;
        }

        if (!cancelled) setIsAuthorized(true);
      } catch {
        router.replace("/");
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
