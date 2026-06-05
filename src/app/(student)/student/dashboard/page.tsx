import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import StudentDashboard from "@/modules/student/ui/views/StudentDashboard";

async function fetchProgress() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gsb_student_token")?.value;
  if (!token) return null;

  try {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
    const protocol =
      headerStore.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const baseUrl = host
      ? `${protocol}://${host}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/student/progress`, {
      headers: { Cookie: `gsb_student_token=${token}` },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function StudentDashboardPage() {
  const data = await fetchProgress();

  if (!data) {
    redirect("/student?error=session_expired");
  }

  return <StudentDashboard data={data} />;
}
