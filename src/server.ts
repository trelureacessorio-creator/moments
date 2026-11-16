import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { authRoutes } from "./auth/routes";
import { syncRoutes } from "./sync/routes";
import { sharingRoutes } from "./sharing/routes";
import { aiRoutes } from "./ai/routes";
import { devRoutes } from "./dev/routes";
import { env } from "./env";

export function buildServer(): FastifyInstance {
  // trustProxy: atrás do Render/Fly o IP real vem no X-Forwarded-For.
  // Sem isso, o rate limit trataria todo mundo como o mesmo IP (o do proxy).
  const app = Fastify({ logger: false, trustProxy: true });

  // Cabeçalhos de segurança (HSTS, nosniff, no-referrer, etc.).
  app.register(helmet, { contentSecurityPolicy: false });

  // Limite global generoso: barra abuso sem atrapalhar o uso normal.
  // Rotas sensíveis (login/cadastro) têm um limite próprio, mais apertado.
  app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    allowList: () => env.NODE_ENV !== "production", // sem limite em dev/testes
  });

  // Upload de áudio para transcrição (voz). Limite de 25 MB por arquivo.
  app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

  const origins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  app.register(cors, { origin: origins.length ? origins : true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "validation", issues: err.issues });
    }
    const status = (err as any).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: err.message || "internal_error" });
  });

  app.get("/health", async () => ({ ok: true, service: "moments-api" }));

  app.register(authRoutes);
  app.register(syncRoutes);
  app.register(sharingRoutes);
  app.register(aiRoutes);
  if (env.NODE_ENV !== "production") app.register(devRoutes);

  return app;
}
