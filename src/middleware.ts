// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyLegacyJWT, verifyInternalJWT } from '@/lib/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. PROTEKSI RUTE SMA (SSO EXTERNAL)
  if (pathname.startsWith('/sma')) {
    const token = request.cookies.get('gsb_legacy_token')?.value;
    const isValid = token ? await verifyLegacyJWT(token) : false;

    if (!isValid) {
      // Redirect ke login web utama jika tidak valid
      const legacyLoginUrl = process.env.LEGACY_LOGIN_URL || 'https://komunitasgsb.id/login';
      return NextResponse.redirect(`${legacyLoginUrl}?callback=${encodeURIComponent(request.url)}`);
    }
  }

  // 2. PROTEKSI RUTE RELAWAN (NATIVE AUTH)
  if (pathname.startsWith('/relawan') && !pathname.includes('/login')) {
    const session = request.cookies.get('gsb_lms_session')?.value;
    const isValid = session ? await verifyInternalJWT(session) : false;

    if (!isValid) {
      return NextResponse.redirect(new URL('/relawan/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/sma/:path*', '/relawan/:path*'],
};
