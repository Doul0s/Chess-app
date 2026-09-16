import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(payload: string): string {
  return createHmac("sha256", config.authSecret).update(payload).digest("base64url");
}

// Token format: base64url(payload).base64url(hmac-sha256(payload)).
export function signToken(userId: string): string {
  const payload = JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyToken(token: string): string | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = sign(encoded);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const { sub, exp } = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof sub !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return sub;
  } catch {
    return null;
  }
}
