import { jwtVerify, SignJWT } from "jose";

function getLmsSecret() {
  const secret = process.env.INTERNAL_JWT_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_JWT_SECRET is not defined in environment variables");
  }
  return new TextEncoder().encode(secret);
}

export async function signInternalJWT(payload: { id: string; role: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getLmsSecret());
}

export async function verifyInternalJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, getLmsSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function verifySsoJWT(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.SSO_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Token sesi student LMS (24 jam), ditandatangani dengan secret internal LMS.
 * Dibuat setelah token handoff SSO (5 menit, secret bersama gsb-web) diverifikasi.
 * Memisahkan kepercayaan handoff dari sesi: secret bersama tidak disimpan di cookie.
 */
export async function signStudentSessionJWT(payload: { id: string; name: string; role: "STUDENT" }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getLmsSecret());
}

export async function verifyStudentSessionJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, getLmsSecret());
    return payload;
  } catch {
    return null;
  }
}
