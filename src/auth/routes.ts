import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, nextRev } from "../db";
import { hashPassword, verifyPassword } from "./password";
import { requireAuth, userId } from "./guard";
import {
  signAccessToken,
  newRefreshSecret,
  hashRefreshSecret,
  composeRefreshToken,
  parseRefreshToken,
  refreshExpiry,
} from "./tokens";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  deviceName: z.string().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().max(120).optional(),
});

function publicUser(u: { id: string; email: string; name: string; status: string; photoUrl?: string | null }) {
  return { id: u.id, email: u.email, name: u.name, status: u.status, photoUrl: u.photoUrl ?? null };
}

async function createSession(uid: string, deviceName?: string, userAgent?: string) {
  const secret = newRefreshSecret();
  const session = await prisma.session.create({
    data: {
      userId: uid,
      refreshHash: hashRefreshSecret(secret),
      deviceName: deviceName ?? null,
      userAgent: userAgent ?? null,
      expiresAt: refreshExpiry(),
    },
  });
  return {
    accessToken: signAccessToken(uid),
    refreshToken: composeRefreshToken(session.id, secret),
  };
}

// Limite apertado para rotas sensíveis a abuso (força bruta / criação em massa).
const strictLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", strictLimit, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.code(409).send({ error: "email_in_use" });

    const user = await prisma.user.create({
      data: { email, name: body.name, passwordHash: await hashPassword(body.password) },
    });
    // Preferências padrão (habilitam as notificações programadas).
    await prisma.preference
      .create({ data: { ownerId: user.id, morning: "07:00", night: "20:00", sunday: "18:00", rev: await nextRev() } })
      .catch(() => {});
    const tokens = await createSession(user.id, body.deviceName, req.headers["user-agent"]);
    return reply.code(201).send({ user: publicUser(user), ...tokens });
  });

  app.post("/auth/login", strictLimit, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    if (user.status === "blocked") return reply.code(403).send({ error: "account_blocked" });
    const tokens = await createSession(user.id, body.deviceName, req.headers["user-agent"]);
    return reply.send({ user: publicUser(user), ...tokens });
  });

  app.post("/auth/refresh", strictLimit, async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) return reply.code(401).send({ error: "invalid_token" });

    const session = await prisma.session.findUnique({ where: { id: parsed.sessionId } });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.refreshHash !== hashRefreshSecret(parsed.secret)
    ) {
      return reply.code(401).send({ error: "invalid_token" });
    }

    // Rotação do refresh: novo segredo a cada uso.
    const secret = newRefreshSecret();
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshHash: hashRefreshSecret(secret), lastUsedAt: new Date() },
    });
    return reply.send({
      accessToken: signAccessToken(session.userId),
      refreshToken: composeRefreshToken(session.id, secret),
    });
  });

  app.post("/auth/logout", async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const parsed = parseRefreshToken(refreshToken);
    if (parsed) {
      await prisma.session.updateMany({
        where: { id: parsed.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return reply.send({ ok: true });
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: userId(req) } });
    if (!user) return reply.code(404).send({ error: "not_found" });
    return reply.send({ user: publicUser(user) });
  });

  // Trocar a senha (precisa da senha atual).
  app.post("/auth/password", { ...strictLimit, preHandler: requireAuth }, async (req, reply) => {
    const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: userId(req) } });
    if (!user) return reply.code(404).send({ error: "not_found" });
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return reply.code(403).send({ error: "wrong_password" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
    return reply.send({ ok: true });
  });

  // Definir/atualizar a foto de perfil (imagem pequena como data URL, enviada pelo cliente).
  app.post("/auth/photo", { preHandler: requireAuth }, async (req, reply) => {
    const { dataUrl } = z.object({ dataUrl: z.string() }).parse(req.body);
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl)) return reply.code(400).send({ error: "invalid_image" });
    if (dataUrl.length > 500_000) return reply.code(413).send({ error: "image_too_large" });
    const user = await prisma.user.update({ where: { id: userId(req) }, data: { photoUrl: dataUrl } });
    return reply.send({ user: publicUser(user) });
  });

  // Remover a foto de perfil.
  app.delete("/auth/photo", { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.update({ where: { id: userId(req) }, data: { photoUrl: null } });
    return reply.send({ user: publicUser(user) });
  });

  app.get("/auth/sessions", { preHandler: requireAuth }, async (req, reply) => {
    const sessions = await prisma.session.findMany({
      where: { userId: userId(req), revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, deviceName: true, userAgent: true, createdAt: true, lastUsedAt: true },
    });
    return reply.send({ sessions });
  });

  // Encerrar a sessão de um dispositivo (ex.: celular perdido).
  app.delete("/auth/sessions/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.session.updateMany({
      where: { id, userId: userId(req), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return reply.send({ ok: true });
  });
}
