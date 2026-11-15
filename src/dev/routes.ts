import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateDueNotifications } from "../notifications/generator";

// Rotas de apoio para desenvolvimento/testes. Registradas apenas fora de produção
// (ver server.ts). Permitem disparar a geração de notificações num instante dado.
export async function devRoutes(app: FastifyInstance) {
  app.post("/dev/run-notifications", async (req) => {
    const { at } = z.object({ at: z.string().optional() }).parse(req.body ?? {});
    const now = at ? new Date(at) : new Date();
    const created = await generateDueNotifications(now);
    return { created };
  });
}
