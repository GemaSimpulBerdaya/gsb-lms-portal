/**
 * UploadThing file router — gerbang upload untuk volunteer & admin.
 *
 * Auth: pakai session JWT existing (gsb_lms_session cookie). Endpoint upload
 * cuma allow user yang udah login dengan role yang sesuai. Token UploadThing
 * (UPLOADTHING_TOKEN) di env.
 *
 * Role mapping (sesuai DB Relawan.role + AnakDidik student-session):
 *   RELAWAN  — volunteer (default Relawan.role)
 *   TIM_PEKAN — akun tim pekan untuk portal volunteer
 *   TIM_LOKASI — legacy akun tim lokasi untuk portal volunteer
 *   TIM_PEKAN_1..4 — legacy akun tim pekan untuk portal volunteer
 *   TIM_AKADEMIK — akun tim akademik untuk area modul
 *   ADMIN    — super admin
 *   SMA      — student (dari student-session JWT)
 *
 * Endpoint:
 *   reportPhoto  — foto KBM volunteer (Report.photoUrls).
 *                  Allow ROLE: RELAWAN/TIM_PEKAN/TIM_LOKASI/TIM_PEKAN_1..4, ADMIN. Max 4MB/file, 6 files/upload.
 *   moduleFile   — file modul belajar (Core.fileUrl).
 *                  Allow ROLE: ADMIN, TIM_AKADEMIK. Max 16MB/file, 1 file/upload.
 *   portfolioFile — karya siswa (StudentPortfolio.fileUrl).
 *                  Allow ROLE: RELAWAN/TIM_PEKAN/TIM_LOKASI/TIM_PEKAN_1..4, ADMIN, SMA. Max 8MB/file.
 *
 * Folder organization (via metadata): UploadThing storage flat, tapi kita kirim
 * `kind` + identifier metadata waktu upload, plus filename pattern di server
 * callback. Ini yang dipakai untuk filter / debugging di dashboard.
 */
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getSessionUser } from "@/lib/session";
import { ACADEMIC_ROLE, ADMIN_ROLE, FIELD_TEAM_ROLES, VOLUNTEER_ROLE } from "@/lib/roles";

const f = createUploadthing();

/** Auth helper — return session payload, throw kalau bukan login. */
async function requireSession() {
  const session = await getSessionUser();
  if (!session) {
    throw new UploadThingError("Unauthorized — silakan login dulu");
  }
  return session;
}

/** Auth helper khusus role tertentu. */
async function requireRole(roles: string[]) {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new UploadThingError(`Akses ditolak — butuh role ${roles.join("/")}`);
  }
  return session;
}

export const ourFileRouter = {
  // ── Foto KBM (volunteer reporting) ─────────────────────────────────────
  reportPhoto: f({
    image: { maxFileSize: "4MB", maxFileCount: 6 },
  })
    .middleware(async () => {
      const session = await requireRole([VOLUNTEER_ROLE, ...FIELD_TEAM_ROLES, ADMIN_ROLE]);
      return { userId: session.id, role: session.role };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("[UT] reportPhoto uploaded", {
        userId: metadata.userId,
        url: file.ufsUrl,
        size: file.size,
      });
      // Return ke client — `ufsUrl` field-nya yang kita simpen ke Report.photoUrls
      return { url: file.ufsUrl, name: file.name, size: file.size };
    }),

  // ── File modul belajar (admin) ────────────────────────────────────────
  moduleFile: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/vnd.ms-powerpoint": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await requireRole([ADMIN_ROLE, ACADEMIC_ROLE]);
      return { userId: session.id, role: session.role };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("[UT] moduleFile uploaded", {
        userId: metadata.userId,
        url: file.ufsUrl,
        size: file.size,
      });
      return { url: file.ufsUrl, name: file.name, size: file.size };
    }),

  // ── Karya siswa (portfolio) ───────────────────────────────────────────
  portfolioFile: f({
    image: { maxFileSize: "8MB", maxFileCount: 4 },
    pdf: { maxFileSize: "8MB", maxFileCount: 2 },
  })
    .middleware(async () => {
      const session = await requireRole([VOLUNTEER_ROLE, ...FIELD_TEAM_ROLES, ADMIN_ROLE, "STUDENT"]);
      return { userId: session.id, role: session.role };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("[UT] portfolioFile uploaded", {
        userId: metadata.userId,
        url: file.ufsUrl,
        size: file.size,
      });
      return { url: file.ufsUrl, name: file.name, size: file.size };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
