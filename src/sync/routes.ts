import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, userId } from "../auth/guard";
import { pull, push } from "./service";
import { collectionNames } from "./registry";
import { generateDueNotifications } from "../notifications/generator";

const pullSchema = z.object({
  cursor: z.number().int().nonnegative().default(0),
  collections: z.array(z.string()).optional(),
});

const pushSchema = z.object({
  changes: z.record(z.array(z.record(z.any()))),
});

export async function syncRoutes(app: FastifyInstance) {
  app.get("/sync/collections", { preHandler: requireAuth }, async () => ({
    collections: collectionNames,
  }));

  app.post("/sync/pull", { preHandler: requireAuth }, async (req) => {
    const body = pullSchema.parse(req.body ?? {});
    const uid = userId(req);
    // Gera os avisos devidos deste usuário aqui também, para que apareçam mesmo
    // em hospedagens que suspendem o processo (sem depender só do agendador).
    await generateDueNotifications(new Date(), uid).catch(() => {});
    return pull(uid, body.cursor, body.collections);
  });

  app.post("/sync/push", { preHandler: requireAuth }, async (req) => {
    const body = pushSchema.parse(req.body ?? {});
    return push(userId(req), body.changes as any);
  });
}
