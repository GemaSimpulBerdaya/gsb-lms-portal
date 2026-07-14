import type { NextRequest } from "next/server";

/**
 * Helper anti-fraud Layer 1: time window validation untuk TeamAttendance.
 *
 * Tujuan: mencegah facilitator mengisi kehadiran sebelum pertemuan dimulai.
 * Input tetap dapat dilakukan setelah pertemuan lewat, tanpa status telat.
 */
export const TEAM_ATTENDANCE_WINDOW = {
  /** Boleh input maks 30 menit sebelum jadwal (untuk prep). */
  earliestMinutesBefore: 30,
} as const;

export interface WindowCheckResult {
  inWindow: boolean;
  reason: "OK" | "TOO_EARLY";
  earliest: Date;
  /** Detik sampai window buka (negatif kalau sudah lewat). */
  secondsUntilOpen: number;
}

export function checkAttendanceWindow(
  kbmDate: Date,
  now: Date = new Date(),
): WindowCheckResult {
  const earliest = new Date(
    kbmDate.getTime() - TEAM_ATTENDANCE_WINDOW.earliestMinutesBefore * 60_000,
  );
  const secondsUntilOpen = Math.round(
    (earliest.getTime() - now.getTime()) / 1000,
  );

  if (now < earliest) {
    return {
      inWindow: false,
      reason: "TOO_EARLY",
      earliest,
      secondsUntilOpen,
    };
  }
  return {
    inWindow: true,
    reason: "OK",
    earliest,
    secondsUntilOpen,
  };
}

/**
 * Format human-readable kenapa window ditolak. Untuk error message ke FE.
 */
export function formatWindowReason(result: WindowCheckResult): string {
  if (result.inWindow) return "OK";
  if (result.reason === "TOO_EARLY") {
    const hours = Math.round(result.secondsUntilOpen / 3600);
    return `Terlalu awal. Bisa input mulai ${result.earliest.toLocaleString("id-ID")} (~${hours} jam lagi).`;
  }
  return "OK";
}

/**
 * Extract IP & UA dari NextRequest untuk audit log Layer 3.
 *
 * Catatan: Next.js 16 di Vercel/standalone tidak expose `request.ip` lagi
 * (deprecated). Kita pakai header standar X-Forwarded-For. Hanya ambil entry
 * pertama (origin client) dan truncate.
 */
export function extractAuditMeta(request: NextRequest | Request): {
  ip?: string;
  userAgent?: string;
} {
  const headers =
    request instanceof Request
      ? request.headers
      : (request as NextRequest).headers;

  // X-Forwarded-For bisa multiple "client, proxy1, proxy2" — ambil yang pertama.
  const xff = headers.get("x-forwarded-for") ?? "";
  const realIp = headers.get("x-real-ip") ?? "";
  const firstHop = xff.split(",")[0]?.trim() || realIp || undefined;
  const ip = firstHop ? firstHop.slice(0, 45) : undefined;

  const ua = headers.get("user-agent") ?? undefined;
  const userAgent = ua ? ua.slice(0, 200) : undefined;

  return { ip, userAgent };
}
