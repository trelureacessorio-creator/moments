import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "./tokens";

/** preHandler que exige um token de acesso válido e injeta req.userId. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  try {
    (req as any).userId = verifyAccessToken(header.slice(7));
  } catch {
    return reply.code(401).send({ error: "invalid_token" });
  }
}

export function userId(req: FastifyRequest): string {
  return (req as any).userId as string;
}
