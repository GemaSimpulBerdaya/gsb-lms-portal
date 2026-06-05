"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccessAdminArea, isAcademicRole } from "@/lib/roles";

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

        if (isAcademicRole(data.user?.role) && window.location.pathname !== "/admin/modules") {
          router.replace("/admin/modules");
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
