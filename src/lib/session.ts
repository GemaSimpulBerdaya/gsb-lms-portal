import { cookies } from "next/headers";
import { verifyInternalJWT } from "@/lib/jwt";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gsb_lms_session")?.value;
  if (!token) return null;

  const payload = await verifyInternalJWT(token);
  if (!payload) return null;

  return payload as { id: string; role: string; email: string };
}
