import { NextResponse } from "next/server";

/**
 * Rate limiter in-memory sederhana (token-bucket per-kunci).
 *
 * Catatan serverless: di Vercel/Netlify state ini per-instance, tidak dibagi
 * antar lambda. Tetap berguna sebagai lapis pertama anti brute-force /
 * email-bombing tanpa menambah dependency eksternal. Kalau butuh limit yang
 * benar-benar global, ganti store ini dengan Upstash Ratelimit (Redis) —
 * antarmuka `rateLimit()` di bawah sengaja dibuat agar gampang ditukar.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms saat window di-reset
}

// Map global supaya selamat dari HMR di dev (mirip pola cache mongoose).
const globalForRate = globalThis as unknown as {
  __rateBuckets?: Map<string, Bucket>;
};
const buckets: Map<string, Bucket> =
  globalForRate.__rateBuckets ?? (globalForRate.__rateBuckets = new Map());

// Bersih-bersih bucket kedaluwarsa sesekali biar Map gak tumbuh tanpa batas.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return; // maksimal sekali per menit
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Jumlah maksimal request dalam satu window. */
  limit: number;
  /** Panjang window dalam milidetik. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Detik sampai window reset (untuk header Retry-After). */
  retryAfter: number;
}

/**
 * Catat satu hit untuk `key`. Return ok=false kalau sudah lewat batas.
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfter: 0 };
  }

  if (existing.count >= opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    retryAfter: 0,
  };
}

/**
 * Ambil IP klien dari header proxy (Vercel set x-forwarded-for).
 * Fallback ke "unknown" supaya tetap ada kunci (semua anonim share 1 bucket —
 * acceptable buat lapis pertama).
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Helper all-in-one untuk route handler. Bangun kunci dari prefix + IP,
 * lalu kembalikan response 429 siap-pakai kalau over limit, atau null kalau lolos.
 *
 * Pemakaian:
 *   const limited = enforceRateLimit(request, "login", { limit: 5, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  request: Request,
  prefix: string,
  opts: RateLimitOptions,
): NextResponse | null {
  const ip = getClientIp(request);
  const result = rateLimit(`${prefix}:${ip}`, opts);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "Terlalu banyak percobaan. Coba lagi nanti." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfter) },
    },
  );
}
