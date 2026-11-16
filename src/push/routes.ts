import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, userId } from "../auth/guard";
import { getPublicKey, sendPushToUser } from "./service";

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function pushRoutes(app: FastifyInstance) {
  // Chave pública VAPID (necessária no navegador para assinar o push).
  app.get("/push/key", async (_req, reply) => {
    const key = await getPublicKey();
    if (!key) return reply.code(503).send({ error: "push_unavailable" });
    return { key };
  });

  // Registra (ou atualiza) a inscrição de push deste dispositivo.
  app.post("/push/subscribe", { preHandler: requireAuth }, async (req, reply) => {
    const uid = userId(req);
    const sub = subSchema.parse(req.body);
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { ownerId: uid, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      create: { ownerId: uid, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return reply.send({ ok: true });
  });

  // Cancela a inscrição deste dispositivo.
  app.post("/push/unsubscribe", { preHandler: requireAuth }, async (req, reply) => {
    const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint, ownerId: userId(req) } });
    return reply.send({ ok: true });
  });

  // Envia um push de teste para os dispositivos do usuário (confirmação rápida).
  app.post("/push/test", { preHandler: requireAuth }, async (req, reply) => {
    const uid = userId(req);
    const count = await prisma.pushSubscription.count({ where: { ownerId: uid } });
    if (!count) return reply.code(409).send({ error: "no_subscription" });
    await sendPushToUser(uid, { title: "Moments", body: "Teste de lembrete ✓ As notificações estão funcionando!", url: "/", tag: "test" });
    return reply.send({ ok: true, devices: count });
  });
}
