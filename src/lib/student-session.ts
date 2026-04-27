import { cookies } from "next/headers";
import { verifyLegacyJWT } from "@/lib/jwt";

export async function getStudentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gsb_student_token")?.value;
  if (!token) return null;

  const payload = await verifyLegacyJWT(token);
  if (!payload) return null;

  return payload as { id: string; name: string; role: 'SMA' };
}
