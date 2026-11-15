import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, nextRev } from "../db";
import { requireAuth, userId } from "../auth/guard";
import { interpret } from "./engine";

export async function aiRoutes(app: FastifyInstance) {
  // Conversa com o assistente. Responde a partir dos dados do usuário e, quando
  // identifica uma intenção de criação, devolve uma sugestão para confirmação.
  // A conversa é persistida como aiMessages (sincroniza entre dispositivos).
  // Nenhum registro de conteúdo é criado aqui — a confirmação é feita no cliente.
  app.post("/ai/message", { preHandler: requireAuth }, async (req) => {
    const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body);
    const uid = userId(req);
    const result = await interpret(uid, text);

    await prisma.aiMessage.create({ data: { ownerId: uid, role: "user", text, rev: await nextRev() } });
    await prisma.aiMessage.create({ data: { ownerId: uid, role: "assistant", text: result.reply, rev: await nextRev() } });

    return result;
  });
}
