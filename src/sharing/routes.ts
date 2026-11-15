import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, nextRev } from "../db";
import { requireAuth, userId } from "../auth/guard";
import { registry } from "../sync/registry";

const createSchema = z.object({
  recipientEmail: z.string().email(),
  entityType: z.string(),
  entityId: z.string(),
  permission: z.enum(["ver", "editar"]),
});

export async function sharingRoutes(app: FastifyInstance) {
  // Compartilhar um item específico com outra conta Moments (por e-mail).
  app.post("/shares", { preHandler: requireAuth }, async (req, reply) => {
    const body = createSchema.parse(req.body);
    const me = userId(req);

    const cfg = registry[body.entityType];
    if (!cfg) return reply.code(400).send({ error: "unknown_collection" });

    // O item precisa existir e ser do solicitante (só o dono compartilha).
    const item = await (prisma as any)[cfg.delegate].findUnique({ where: { id: body.entityId } });
    if (!item || item.deletedAt) return reply.code(404).send({ error: "item_not_found" });
    if (item.ownerId !== me) return reply.code(403).send({ error: "not_owner" });

    const recipient = await prisma.user.findUnique({
      where: { email: body.recipientEmail.toLowerCase() },
    });
    if (!recipient) return reply.code(404).send({ error: "recipient_not_found" });
    if (recipient.id === me) return reply.code(400).send({ error: "cannot_share_with_self" });

    const share = await prisma.share.upsert({
      where: {
        ownerId_recipientId_entityType_entityId: {
          ownerId: me,
          recipientId: recipient.id,
          entityType: body.entityType,
          entityId: body.entityId,
        },
      },
      update: { permission: body.permission, status: "active" },
      create: {
        ownerId: me,
        recipientId: recipient.id,
        entityType: body.entityType,
        entityId: body.entityId,
        permission: body.permission,
      },
    });

    // Bumpa o rev do item para que ele entre no próximo pull do destinatário.
    await (prisma as any)[cfg.delegate].update({
      where: { id: body.entityId },
      data: { rev: await nextRev() },
    });

    return reply.code(201).send({ share: { ...share, recipientEmail: recipient.email } });
  });

  // Lista o que compartilhei e o que foi compartilhado comigo.
  app.get("/shares", { preHandler: requireAuth }, async (req) => {
    const me = userId(req);
    const [created, received] = await Promise.all([
      prisma.share.findMany({ where: { ownerId: me, status: "active" } }),
      prisma.share.findMany({ where: { recipientId: me, status: "active" } }),
    ]);
    const userIds = [
      ...new Set([...created.map((s) => s.recipientId), ...received.map((s) => s.ownerId)]),
    ];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      created: created.map((s) => ({ ...s, recipient: byId.get(s.recipientId) ?? null })),
      received: received.map((s) => ({ ...s, owner: byId.get(s.ownerId) ?? null })),
    };
  });

  // Encerrar um compartilhamento (apenas o dono).
  app.delete("/shares/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const share = await prisma.share.findUnique({ where: { id } });
    if (!share || share.ownerId !== userId(req)) {
      return reply.code(404).send({ error: "not_found" });
    }
    await prisma.share.update({ where: { id }, data: { status: "revoked" } });
    return reply.send({ ok: true });
  });

  // Histórico de alterações nos meus itens compartilhados (quem, o quê, antes, depois).
  app.get("/shares/activity", { preHandler: requireAuth }, async (req) => {
    const me = userId(req);
    const logs = await prisma.changeLog.findMany({
      where: { ownerId: me },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const actorIds = [...new Set(logs.map((l) => l.actorId))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(actors.map((a) => [a.id, a]));
    return { activity: logs.map((l) => ({ ...l, actor: byId.get(l.actorId) ?? null })) };
  });
}
