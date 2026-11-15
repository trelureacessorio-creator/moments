import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { authRoutes } from "./auth/routes";
import { syncRoutes } from "./sync/routes";
import { sharingRoutes } from "./sharing/routes";
import { devRoutes } from "./dev/routes";
import { env } from "./env";

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: true });

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
  if (env.NODE_ENV !== "production") app.register(devRoutes);

  return app;
}
