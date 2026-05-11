import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StudentDashboard from "@/modules/student/ui/views/StudentDashboard";

async function getModules() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gsb_student_token")?.value;

  if (!token) {
    return null;
  }

  // We call the internal API. In a real server-side call, we might need the full URL
  // or we can just refactor the API logic into a service. 
  // For simplicity here, let's assume we can fetch it or just use the logic directly.
  // However, fetching from localhost in a server component can be tricky with ports.
  
  // Let's try to fetch it from the same origin
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${baseUrl}/api/student/modules`, {
      headers: {
        Cookie: `gsb_student_token=${token}`
      },
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch (error) {
    console.error("Error fetching modules:", error);
    return null;
  }
}

export default async function StudentDashboardPage() {
  const data = await getModules();

  if (!data) {
    redirect("/student?error=session_expired");
  }

  return <StudentDashboard data={data} />;
}
