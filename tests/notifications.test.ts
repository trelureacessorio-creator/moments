import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { makeApp, resetDb, register, bearer } from "./helpers";
import { prisma, nextRev } from "../src/db";
import { generateDueNotifications } from "../src/notifications/generator";

const app = makeApp();
beforeAll(async () => { await app.ready(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); });

// Usa UTC nas preferências para tornar as comparações de horário determinísticas.
function utcToday() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(base: string, n: number) {
  return new Date(Date.parse(`${base}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
async function setPrefs(ownerId: string, patch: any) {
  await prisma.preference.update({ where: { ownerId }, data: { timezone: "UTC", ...patch } });
}

describe("agendador de notificações", () => {
  it("gera o resumo da manhã uma única vez (idempotente)", async () => {
    const u = await register(app, "a@x.com");
    await setPrefs(u.userId, { morning: "07:00" });
    const today = utcToday();
    await prisma.task.create({ data: { ownerId: u.userId, text: "t1", done: false, date: today, rev: await nextRev() } });
    await prisma.appointment.create({ data: { ownerId: u.userId, title: "c1", date: today, time: "10:00", rev: await nextRev() } });

    const now = new Date(`${today}T08:00:00Z`);
    expect(await generateDueNotifications(now)).toBeGreaterThanOrEqual(1);
    const count1 = await prisma.notification.count({ where: { ownerId: u.userId, type: "morning" } });
    expect(count1).toBe(1);
    // rodar de novo não duplica
    await generateDueNotifications(now);
    const count2 = await prisma.notification.count({ where: { ownerId: u.userId, type: "morning" } });
    expect(count2).toBe(1);
  });

  it("a conferência noturna conta só as tarefas pendentes", async () => {
    const u = await register(app, "a@x.com");
    await setPrefs(u.userId, { night: "20:00", morning: "99:99" });
    const today = utcToday();
    await prisma.task.create({ data: { ownerId: u.userId, text: "pendente", done: false, rev: await nextRev() } });
    await prisma.task.create({ data: { ownerId: u.userId, text: "feita", done: true, doneAt: today, rev: await nextRev() } });

    await generateDueNotifications(new Date(`${today}T20:30:00Z`));
    const n = await prisma.notification.findFirst({ where: { ownerId: u.userId, type: "night" } });
    expect(n).toBeTruthy();
    expect(n!.message).toContain("1 tarefa");
  });

  it("alerta de meta dispara a exatamente 10 dias do prazo (não 9 nem 11)", async () => {
    const u = await register(app, "a@x.com");
    await setPrefs(u.userId, { morning: "99:99", night: "99:99" });
    const today = utcToday();
    await prisma.goal.create({ data: { ownerId: u.userId, name: "Meta 10", type: "count", targetValue: 10, currentValue: 2, startDate: today, deadline: addDaysIso(today, 10), rev: await nextRev() } });
    await prisma.goal.create({ data: { ownerId: u.userId, name: "Meta 9", type: "count", targetValue: 10, currentValue: 2, startDate: today, deadline: addDaysIso(today, 9), rev: await nextRev() } });

    await generateDueNotifications(new Date(`${today}T09:00:00Z`));
    const alerts = await prisma.notification.findMany({ where: { ownerId: u.userId, type: "goal_alert" } });
    expect(alerts.length).toBe(1);
    expect(alerts[0].message).toContain("Meta 10");
  });

  it("alteração em item compartilhado gera aviso ao dono", async () => {
    const a = await register(app, "a@x.com", "Ana");
    const b = await register(app, "b@x.com", "Bia");
    const id = crypto.randomUUID();
    await app.inject({ method: "POST", url: "/sync/push", headers: bearer(a.accessToken), payload: { changes: { appointments: [{ id, title: "Consulta", date: "2026-11-15", time: "14:00" }] } } });
    await app.inject({ method: "POST", url: "/shares", headers: bearer(a.accessToken), payload: { recipientEmail: "b@x.com", entityType: "appointments", entityId: id, permission: "editar" } });
    await app.inject({ method: "POST", url: "/sync/push", headers: bearer(b.accessToken), payload: { changes: { appointments: [{ id, time: "15:00" }] } } });

    const notes = await prisma.notification.findMany({ where: { ownerId: a.userId, type: "shared_change" } });
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0].message).toContain("Bia");
  });
});
