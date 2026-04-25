import { jwtVerify, SignJWT } from "jose";

function getLmsSecret() {
  return new TextEncoder().encode(process.env.INTERNAL_JWT_SECRET);
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

export async function verifyLegacyJWT(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.LEGACY_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}
