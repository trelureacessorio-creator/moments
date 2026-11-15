import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { makeApp, resetDb, register, bearer } from "./helpers";
import { prisma } from "../src/db";

const app = makeApp();
beforeAll(async () => { await app.ready(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); });

async function push(token: string, changes: any) {
  return (await app.inject({ method: "POST", url: "/sync/push", headers: bearer(token), payload: { changes } })).json();
}
async function pull(token: string, cursor = 0) {
  return (await app.inject({ method: "POST", url: "/sync/pull", headers: bearer(token), payload: { cursor } })).json();
}

describe("privacidade", () => {
  it("um usuário não enxerga nem edita os dados de outro sem compartilhamento", async () => {
    const a = await register(app, "a@x.com", "Ana");
    const b = await register(app, "b@x.com", "Bia");

    const id = crypto.randomUUID();
    await push(a.accessToken, { diary: [{ id, date: "2026-11-15", time: "21:00", title: "Meu dia", text: "particular" }] });

    // B não recebe nada de A
    const pb = await pull(b.accessToken, 0);
    expect(pb.changes.diary).toBeUndefined();

    // B tenta editar o registro de A (sem share) → rejeitado
    const r = await push(b.accessToken, { diary: [{ id, title: "invadido" }] });
    expect(r.applied).toHaveLength(0);
    expect(r.rejected[0].reason).toBe("forbidden");

    // O registro de A continua intacto
    const row = await prisma.diaryEntry.findUnique({ where: { id } });
    expect(row?.title).toBe("Meu dia");
    expect(row?.ownerId).toBe(a.userId);
  });
});
