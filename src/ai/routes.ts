import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, nextRev } from "../db";
import { requireAuth, userId } from "../auth/guard";
import { interpret, analyzeDiaryFull } from "./engine";
import { isGeminiEnabled, geminiDiagnose } from "./gemini";
import { isClaudeEnabled } from "./claude";

export async function aiRoutes(app: FastifyInstance) {
  // Diagnóstico público (sem segredos): mostra qual provedor está ativo e testa o Gemini.
  // Serve para verificar a configuração em produção. Pode ser removido depois.
  app.get("/ai/health", async () => {
    const gemini = await geminiDiagnose();
    return { geminiEnabled: isGeminiEnabled(), claudeEnabled: isClaudeEnabled(), gemini };
  });

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

  // Diário inteligente: analisa um relato e devolve título, resumo, sentimento e
  // eventuais sugestões (ex.: um compromisso citado). Não cria nada — o usuário
  // revisa e confirma no cliente, que salva o relato via sincronização.
  app.post("/ai/diary/analyze", { preHandler: requireAuth }, async (req) => {
    const { text } = z.object({ text: z.string().min(1).max(5000) }).parse(req.body);
    return analyzeDiaryFull(userId(req), text);
  });
}
