import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, nextRev } from "../db";
import { requireAuth, userId } from "../auth/guard";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB por arquivo (protege o armazenamento gratuito)

// Verifica se o usuário pode LER o arquivo: dono ou com compartilhamento ativo.
async function canRead(fileId: string, uid: string): Promise<{ ownerId: string } | null> {
  const item = await prisma.fileItem.findUnique({ where: { id: fileId }, select: { ownerId: true, deletedAt: true } });
  if (!item || item.deletedAt) return null;
  if (item.ownerId === uid) return { ownerId: item.ownerId };
  const share = await prisma.share.findFirst({
    where: { entityType: "files", entityId: fileId, recipientId: uid, status: "active" },
    select: { id: true },
  });
  return share ? { ownerId: item.ownerId } : null;
}

export async function fileRoutes(app: FastifyInstance) {
  // Envia (ou substitui) o conteúdo binário de um arquivo já criado (metadados via sync).
  // Só o dono envia. Guarda o binário na tabela FileBlob (fora da sincronização).
  app.post("/files/:id/upload", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const uid = userId(req);
    const item = await prisma.fileItem.findUnique({ where: { id }, select: { ownerId: true, deletedAt: true, name: true } });
    if (!item || item.deletedAt) return reply.code(404).send({ error: "not_found" });
    if (item.ownerId !== uid) return reply.code(403).send({ error: "forbidden" });

    const file = await (req as any).file();
    if (!file) return reply.code(400).send({ error: "no_file" });
    const buf: Buffer = await file.toBuffer();
    if (!buf?.length) return reply.code(400).send({ error: "empty_file" });
    if (buf.length > MAX_BYTES) return reply.code(413).send({ error: "file_too_large", maxBytes: MAX_BYTES });

    const mime = file.mimetype || "application/octet-stream";
    // upsert: um blob por arquivo (substitui se reenviar).
    const existing = await prisma.fileBlob.findUnique({ where: { fileItemId: id }, select: { id: true } });
    if (existing) {
      await prisma.fileBlob.update({ where: { fileItemId: id }, data: { mime, size: buf.length, data: buf } });
    } else {
      await prisma.fileBlob.create({ data: { fileItemId: id, ownerId: uid, mime, size: buf.length, data: buf } });
    }
    // Marca no FileItem que há conteúdo e propaga via sync (rev novo).
    await prisma.fileItem.update({ where: { id }, data: { storageKey: "db", rev: await nextRev() } });

    return { ok: true, size: buf.length, mime };
  });

  // Baixa/visualiza o conteúdo do arquivo (dono ou compartilhado).
  app.get("/files/:id/content", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const access = await canRead(id, userId(req));
    if (!access) return reply.code(404).send({ error: "not_found" });
    const blob = await prisma.fileBlob.findUnique({ where: { fileItemId: id } });
    if (!blob) return reply.code(404).send({ error: "no_content" });
    const item = await prisma.fileItem.findUnique({ where: { id }, select: { name: true } });
    const safeName = (item?.name || "arquivo").replace(/[^\w.\- ]+/g, "_");
    reply.header("content-type", blob.mime);
    reply.header("content-disposition", `inline; filename="${safeName}"`);
    reply.header("cache-control", "private, max-age=3600");
    return reply.send(Buffer.from(blob.data));
  });
}
