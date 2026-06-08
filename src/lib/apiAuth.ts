import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/session";
import { canManageModules, canAccessVolunteerPortal, isAdminRole } from "@/lib/roles";

/**
 * Bentuk session yang dikembalikan getSessionUser (JWT internal).
 */
export interface SessionUser {
  id: string;
  role: string;
  email: string;
}

/**
 * Context route Next.js App Router. Untuk route dinamis ([id]) params adalah
 * Promise yang harus di-await. Untuk route statis context-nya kosong.
 */
type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Handler yang sudah ter-autentikasi — menerima session sebagai argumen ke-3,
 * jadi handler tidak perlu memanggil getSessionUser sendiri.
 */
type AuthedHandler<C> = (
  request: NextRequest,
  session: SessionUser,
  context: C,
) => Promise<Response> | Response;

interface WithAuthOptions {
  /**
   * Predikat otorisasi atas role. Return true = boleh. Default: semua user
   * terautentikasi boleh (cuma cek login). Pakai helper dari @/lib/roles.
   */
  authorize?: (role: string) => boolean;
}

/**
 * Bungkus route handler dengan guard auth standar:
 *   - 401 kalau tidak ada session valid.
 *   - 403 kalau ada session tapi role tidak lolos `authorize`.
 *   - selain itu, panggil handler dengan (request, session, context).
 *
 * Menggantikan boilerplate `const session = await getSessionUser(); if (!session
 * || session.role !== "ADMIN") return 401` yang berulang di puluhan route.
 *
 * Contoh:
 *   export const GET = withAuth(async (req, session) => { ... }, { authorize: isAdminRole });
 *   export const PUT = withAuth(async (req, session, { params }) => {
 *     const { id } = await params; ...
 *   }, { authorize: isAdminRole });
 */
export function withAuth<C = RouteContext>(
  handler: AuthedHandler<C>,
  options: WithAuthOptions = {},
) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (options.authorize && !options.authorize(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, session as SessionUser, context);
  };
}

/** Hanya Super Admin (role === "ADMIN" persis). */
export const withAdmin = <C = RouteContext>(handler: AuthedHandler<C>) =>
  withAuth(handler, { authorize: (role) => role === "ADMIN" });

/**
 * Hanya Super Admin, tapi cek lewat isAdminRole (normalize trim + uppercase).
 * Pakai ini kalau route lama memang memvalidasi dengan isAdminRole, bukan
 * perbandingan literal "ADMIN" — supaya semantik (toleransi casing/spasi) sama persis.
 */
export const withAdminRole = <C = RouteContext>(handler: AuthedHandler<C>) =>
  withAuth(handler, { authorize: isAdminRole });

/** Admin + Tim Akademik (kelola modul / data module-centric). */
export const withModuleManager = <C = RouteContext>(handler: AuthedHandler<C>) =>
  withAuth(handler, { authorize: canManageModules });

/** Portal volunteer (RELAWAN + tim lapangan). */
export const withVolunteer = <C = RouteContext>(handler: AuthedHandler<C>) =>
  withAuth(handler, { authorize: canAccessVolunteerPortal });
