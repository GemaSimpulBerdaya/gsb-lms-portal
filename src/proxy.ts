// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyLegacyJWT, verifyInternalJWT } from '@/lib/jwt';

const PROTECTED_ROUTES = ['/dashboard', '/admin', '/reporting', '/laporan', '/input-grade'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. PROTEKSI RUTE SMA (SSO EXTERNAL)
  if (pathname.startsWith('/sma')) {
    const token = request.cookies.get('gsb_legacy_token')?.value;
    const isValid = token ? await verifyLegacyJWT(token) : false;

    if (!isValid) {
      const legacyLoginUrl =
        process.env.LEGACY_LOGIN_URL || 'https://komunitasgsb.id/login';
      return NextResponse.redirect(
        `${legacyLoginUrl}?callback=${encodeURIComponent(request.url)}`
      );
    }
  }

  // 2. PROTEKSI RUTE RELAWAN (NATIVE AUTH)
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected) {
    const session = request.cookies.get('gsb_lms_session')?.value;
    const payload = session ? await verifyInternalJWT(session) : null;

    if (!payload) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Role guard: hanya ADMIN boleh akses /admin
    if (pathname.startsWith('/admin') && (payload as any).role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/sma/:path*',
    '/relawan/:path*',
    '/dashboard/:path*',
    '/dashboard',
    '/admin/:path*',
    '/admin',
    '/reporting/:path*',
    '/reporting',
    '/laporan/:path*',
    '/laporan',
    '/input-grade/:path*',
    '/input-grade',
  ],
};