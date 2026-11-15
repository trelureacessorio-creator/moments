import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../env";

/** Token de acesso: JWT curto, assinado. */
export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TTL_MIN}m`,
  });
}

export function verifyAccessToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
  return payload.sub;
}

/**
 * Refresh token opaco no formato `${sessionId}.${secret}`.
 * Guardamos no banco apenas o hash do `secret` (nunca o token em claro).
 */
export function newRefreshSecret(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function composeRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(
  token: string
): { sessionId: string; secret: string } | null {
  const i = token.indexOf(".");
  if (i <= 0) return null;
  return { sessionId: token.slice(0, i), secret: token.slice(i + 1) };
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}
