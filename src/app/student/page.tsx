import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyLegacyJWT } from "@/lib/jwt";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function StudentSSOHandler({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.token as string;

  if (!token) {
    console.error("SSO Error: No token provided");
    redirect("/?error=no_token");
  }

  const payload = await verifyLegacyJWT(token);

  if (!payload || payload.role !== "SMA") {
    console.error("SSO Error: Invalid token or role", payload);
    redirect("/?error=invalid_token");
  }

  // Set the student session cookie
  const cookieStore = await cookies();
  cookieStore.set("gsb_student_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
    path: "/",
  });

  // Redirect to student dashboard
  redirect("/student/dashboard");
}

export default function StudentPage(props: PageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 border-4 border-gsb-maroon border-t-transparent rounded-full animate-spin"></div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800">Menyiapkan Sesi Belajar</h1>
          <p className="text-slate-500">Mohon tunggu sebentar, kami sedang memverifikasi akun Anda...</p>
        </div>
        <Suspense fallback={null}>
          <StudentSSOHandler {...props} />
        </Suspense>
      </div>
    </div>
  );
}
