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
async function share(token: string, payload: any) {
  return app.inject({ method: "POST", url: "/shares", headers: bearer(token), payload });
}

describe("compartilhamento", () => {
  it("compartilha por e-mail; 'ver' deixa visualizar mas não editar", async () => {
    const a = await register(app, "a@x.com", "Ana");
    const b = await register(app, "b@x.com", "Bia");

    const id = crypto.randomUUID();
    await push(a.accessToken, { appointments: [{ id, title: "Consulta", date: "2026-11-15", time: "14:00" }] });

    const s = await share(a.accessToken, { recipientEmail: "b@x.com", entityType: "appointments", entityId: id, permission: "ver" });
    expect(s.statusCode).toBe(201);

    // B passa a enxergar o compromisso compartilhado
    const pb = await pull(b.accessToken, 0);
    expect(pb.changes.appointments?.[0]?.id).toBe(id);

    // mas não pode editar (só 'ver')
    const edit = await push(b.accessToken, { appointments: [{ id, time: "15:00" }] });
    expect(edit.rejected[0]?.reason).toBe("forbidden");
  });

  it("'editar' permite alterar e gera histórico para o dono", async () => {
    const a = await register(app, "a@x.com", "Ana");
    const b = await register(app, "b@x.com", "Bia");

    const id = crypto.randomUUID();
    await push(a.accessToken, { appointments: [{ id, title: "Consulta", date: "2026-11-15", time: "14:00" }] });
    await share(a.accessToken, { recipientEmail: "b@x.com", entityType: "appointments", entityId: id, permission: "editar" });

    const edit = await push(b.accessToken, { appointments: [{ id, time: "15:00" }] });
    expect(edit.applied[0]?.id).toBe(id);

    // o compromisso mudou, mas o dono continua sendo A
    const row = await prisma.appointment.findUnique({ where: { id } });
    expect(row?.time).toBe("15:00");
    expect(row?.ownerId).toBe(a.userId);

    // A recebe o histórico: quem, o quê, antes, depois
    const act = await app.inject({ method: "GET", url: "/shares/activity", headers: bearer(a.accessToken) });
    const activity = act.json().activity;
    const entry = activity.find((l: any) => l.field === "time");
    expect(entry).toBeTruthy();
    expect(entry.before).toBe("14:00");
    expect(entry.after).toBe("15:00");
    expect(entry.actor.email).toBe("b@x.com");
  });

  it("revogar o compartilhamento tira o item das próximas sincronizações do destinatário", async () => {
    const a = await register(app, "a@x.com", "Ana");
    const b = await register(app, "b@x.com", "Bia");
    const id = crypto.randomUUID();
    await push(a.accessToken, { appointments: [{ id, title: "Consulta", date: "2026-11-15", time: "14:00" }] });
    const s = await share(a.accessToken, { recipientEmail: "b@x.com", entityType: "appointments", entityId: id, permission: "ver" });
    const shareId = s.json().share.id;

    await app.inject({ method: "DELETE", url: `/shares/${shareId}`, headers: bearer(a.accessToken) });

    const pb = await pull(b.accessToken, 0);
    expect(pb.changes.appointments).toBeUndefined();
  });
});
