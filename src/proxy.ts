// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyInternalJWT } from '@/lib/jwt';
import { canAccessAdminArea, canAccessVolunteerPortal, isAcademicRole, isAdminRole, isAcademicAllowedPath, ACADEMIC_LANDING } from '@/lib/roles';

const VOLUNTEER_PATHS = [
  '/dashboard',
  '/schedule',
  '/evaluation',
  '/reporting',
  '/laporan',
  '/input-grade',
  '/students-data',
  '/attendance',
  '/team-attendance',
  '/portfolio',
];

const PROTECTED_ROUTES = ['/admin', ...VOLUNTEER_PATHS];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('gsb_lms_session')?.value;

  // 1. IZINKAN AKSES KE LOGIN / HOME JIKA BELUM AUTH
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/api/auth')) {
    if (token) {
      try {
        const payload = await verifyInternalJWT(token);
        if (payload) {
          const role = (payload as { role?: string }).role;
          if (isAdminRole(role)) {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
          } else if (isAcademicRole(role)) {
            return NextResponse.redirect(new URL(ACADEMIC_LANDING, request.url));
          } else {
            return NextResponse.redirect(new URL('/dashboard', request.url));
          }
        }
      } catch {
        // Token invalid, biarkan akses login
      }
    }
    return NextResponse.next();
  }

  // 2. PROTEKSI RUTE DASHBOARD & ADMIN
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const payload = await verifyInternalJWT(token);
      if (!payload) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      const role = (payload as { role?: string }).role;

      // Role guard: ADMIN penuh, Tim Akademik hanya area yang di-allowlist.
      if (pathname.startsWith('/admin') && !canAccessAdminArea(role)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      if (
        pathname.startsWith('/admin') &&
        isAcademicRole(role) &&
        !isAcademicAllowedPath(pathname)
      ) {
        return NextResponse.redirect(new URL(ACADEMIC_LANDING, request.url));
      }

      // Role guard: portal relawan hanya untuk Relawan/Tim Pekan.
      const isVolunteerPath = VOLUNTEER_PATHS.some(p => pathname.startsWith(p));
      
      if (isVolunteerPath && !canAccessVolunteerPortal(role)) {
        const target = isAcademicRole(role) ? ACADEMIC_LANDING : '/admin/dashboard';
        return NextResponse.redirect(new URL(target, request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/relawan/:path*',
    '/dashboard/:path*',
    '/dashboard',
    '/schedule/:path*',
    '/schedule',
    '/evaluation/:path*',
    '/evaluation',
    '/admin/:path*',
    '/admin',
    '/reporting/:path*',
    '/reporting',
    '/laporan/:path*',
    '/laporan',
    '/input-grade/:path*',
    '/input-grade',
    '/students-data/:path*',
    '/students-data',
    '/attendance/:path*',
    '/attendance',
    '/team-attendance/:path*',
    '/team-attendance',
    '/portfolio/:path*',
    '/portfolio',
  ],
};
