import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Entry point SSO student dari gsb-web: /student?token=<jwt>
 *
 * Penanganan token (verifikasi + set cookie) dilakukan di Route Handler
 * `/api/student/sso` karena Next.js 16 melarang set cookie saat render page.
 * Page ini hanya meneruskan token ke handler tersebut.
 */
export default async function StudentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    redirect("/?error=no_token");
  }

  redirect(`/api/student/sso?token=${encodeURIComponent(token)}`);
}
