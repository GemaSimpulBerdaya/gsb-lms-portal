// src/lib/jwt.ts
import { jwtVerify } from "jose";

export async function verifyLegacyJWT(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.LEGACY_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function verifyInternalJWT(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.INTERNAL_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}
