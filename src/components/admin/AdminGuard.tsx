"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
        if (data.user?.role !== "ADMIN") {
          router.replace("/dashboard");
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
