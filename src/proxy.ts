// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyLegacyJWT, verifyInternalJWT } from '@/lib/jwt';

const PROTECTED_ROUTES = ['/dashboard', '/admin', '/reporting', '/laporan', '/input-grade'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('gsb_lms_session')?.value;

  // 1. IZINKAN AKSES KE LOGIN / HOME JIKA BELUM AUTH
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/api/auth')) {
    if (token) {
      try {
        const payload = await verifyInternalJWT(token);
        if (payload) {
          const role = (payload as any).role;
          if (role === 'ADMIN') {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
          } else {
            return NextResponse.redirect(new URL('/dashboard', request.url));
          }
        }
      } catch (e) {
        // Token invalid, biarkan akses login
      }
    }
    return NextResponse.next();
  }

  // 2. PROTEKSI RUTE SMA (SSO EXTERNAL)
  if (pathname.startsWith('/sma')) {
    const legacyToken = request.cookies.get('gsb_legacy_token')?.value;
    const isValid = legacyToken ? await verifyLegacyJWT(legacyToken) : false;

    if (!isValid) {
      const legacyLoginUrl = process.env.LEGACY_LOGIN_URL || 'https://komunitasgsb.id/login';
      return NextResponse.redirect(`${legacyLoginUrl}?callback=${encodeURIComponent(request.url)}`);
    }
  }

  // 3. PROTEKSI RUTE DASHBOARD & ADMIN
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

      const role = (payload as any).role;

      // Role guard: hanya ADMIN boleh akses /admin
      if (pathname.startsWith('/admin') && role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // Role guard: ADMIN tidak boleh akses dashboard relawan
      const volunteerPaths = ['/dashboard', '/schedule', '/evaluation', '/reporting', '/input-grade'];
      const isVolunteerPath = volunteerPaths.some(p => pathname.startsWith(p));
      
      if (isVolunteerPath && role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
    } catch (err) {
      return NextResponse.redirect(new URL('/login', request.url));
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