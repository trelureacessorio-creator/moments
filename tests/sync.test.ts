import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { makeApp, resetDb, register, bearer } from "./helpers";
import { prisma } from "../src/db";

const app = makeApp();
beforeAll(async () => { await app.ready(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); });

async function push(token: string, changes: any) {
  const res = await app.inject({ method: "POST", url: "/sync/push", headers: bearer(token), payload: { changes } });
  return res.json();
}
async function pull(token: string, cursor = 0) {
  const res = await app.inject({ method: "POST", url: "/sync/pull", headers: bearer(token), payload: { cursor } });
  return res.json();
}

describe("sincronização", () => {
  it("cria, baixa, atualiza e exclui com versionamento", async () => {
    const u = await register(app, "a@x.com");
    const id = crypto.randomUUID();

    // create
    const r1 = await push(u.accessToken, { tasks: [{ id, text: "Comprar fraldas", done: false }] });
    expect(r1.applied).toHaveLength(1);
    expect(r1.applied[0].rev).toBeGreaterThan(0);

    // pull desde 0 traz a tarefa
    const p1 = await pull(u.accessToken, 0);
    expect(p1.changes.tasks).toHaveLength(1);
    expect(p1.changes.tasks[0].text).toBe("Comprar fraldas");
    const cursor1 = p1.cursor;

    // update incremental
    const r2 = await push(u.accessToken, { tasks: [{ id, done: true, doneAt: "2026-11-15", baseRev: r1.applied[0].rev }] });
    expect(r2.applied[0].rev).toBeGreaterThan(r1.applied[0].rev);

    // pull desde o cursor anterior traz só a mudança
    const p2 = await pull(u.accessToken, cursor1);
    expect(p2.changes.tasks).toHaveLength(1);
    expect(p2.changes.tasks[0].done).toBe(true);

    // delete (tombstone)
    await push(u.accessToken, { tasks: [{ id, deleted: true }] });
    const p3 = await pull(u.accessToken, cursor1);
    expect(p3.changes.tasks[0].deletedAt).toBeTruthy();
  });

  it("detecta conflito quando o baseRev está desatualizado", async () => {
    const u = await register(app, "a@x.com");
    const id = crypto.randomUUID();
    const r1 = await push(u.accessToken, { tasks: [{ id, text: "v1", done: false }] });
    // avança o servidor para rev 2
    await push(u.accessToken, { tasks: [{ id, text: "v2", baseRev: r1.applied[0].rev }] });
    // cliente desatualizado ainda acha que está no rev 1
    const r3 = await push(u.accessToken, { tasks: [{ id, text: "v3", baseRev: r1.applied[0].rev }] });
    expect(r3.conflicts.length).toBe(1);
    expect(r3.conflicts[0].id).toBe(id);
  });
});
