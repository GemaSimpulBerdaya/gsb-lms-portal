"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        router.replace("/");
        return;
      }

      try {
        const user = JSON.parse(userStr);
        if (user.role !== "ADMIN") {
          router.replace("/dashboard"); // Redirect normal volunteers back to their dashboard
        } else {
          setIsAuthorized(true);
        }
      } catch {
        router.replace("/");
      }
    });
  }, [router]);

  if (!isAuthorized) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
}
