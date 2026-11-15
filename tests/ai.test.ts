import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { makeApp, resetDb, register, bearer } from "./helpers";
import { prisma, nextRev } from "../src/db";

const app = makeApp();
beforeAll(async () => { await app.ready(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); });

function today() { return new Date().toISOString().slice(0, 10); }
function plus(n: number) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

async function ask(token: string, text: string) {
  const res = await app.inject({ method: "POST", url: "/ai/message", headers: bearer(token), payload: { text } });
  return res.json() as any;
}

async function seed(userId: string) {
  await prisma.preference.update({ where: { ownerId: userId }, data: { timezone: "UTC" } });
  await prisma.appointment.create({ data: { ownerId: userId, title: "Consulta pediátrica", date: plus(2), time: "14:00", place: "Clínica Vida", rev: await nextRev() } });
  await prisma.task.create({ data: { ownerId: userId, text: "Comprar fraldas", done: false, date: today(), rev: await nextRev() } });
  await prisma.financeNote.create({ data: { ownerId: userId, type: "economia", amount: 50, date: today(), rev: await nextRev() } });
  await prisma.goal.create({ data: { ownerId: userId, name: "Reserva", type: "money", targetValue: 5000, currentValue: 3200, startDate: today(), deadline: plus(30), rev: await nextRev() } });
}

describe("assistente e busca inteligente", () => {
  it("responde o próximo compromisso a partir dos dados", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    const r = await ask(u.accessToken, "qual meu próximo compromisso?");
    expect(r.reply).toContain("Consulta pediátrica");
    expect(r.suggestion).toBeUndefined();
  });

  it("responde quanto economizei no mês", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    const r = await ask(u.accessToken, "quanto economizei este mês?");
    expect(r.reply).toContain("R$ 50");
  });

  it("responde quanto falta para a meta", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    const r = await ask(u.accessToken, "quanto falta para minha meta?");
    expect(r.reply).toMatch(/R\$\s*1\.?800/);
  });

  it("lista tarefas de hoje", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    const r = await ask(u.accessToken, "quais tarefas tenho hoje?");
    expect(r.reply).toContain("Comprar fraldas");
  });

  it("não encontrando, é honesto (não inventa)", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    const r = await ask(u.accessToken, "qual a capital da França?");
    expect(r.reply.toLowerCase()).toContain("não encontrei");
  });

  it("intenção de criar devolve sugestão e NÃO cria nada", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    const before = await prisma.appointment.count({ where: { ownerId: u.userId } });
    const r = await ask(u.accessToken, "marque dentista amanhã às 9h");
    expect(r.suggestion).toBeTruthy();
    expect(r.suggestion.collection).toBe("appointments");
    expect(r.suggestion.fields.time).toBe("09:00");
    expect(r.suggestion.fields.title).toBe("Dentista");
    const after = await prisma.appointment.count({ where: { ownerId: u.userId } });
    expect(after).toBe(before); // nada criado sem confirmação
  });

  it("registro financeiro vira sugestão de economia", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    const r = await ask(u.accessToken, "economizei 50 reais hoje");
    expect(r.suggestion.collection).toBe("financeNotes");
    expect(r.suggestion.fields.type).toBe("economia");
    expect(r.suggestion.fields.amount).toBe(50);
  });

  it("persiste a conversa como aiMessages", async () => {
    const u = await register(app, "a@x.com"); await seed(u.userId);
    await ask(u.accessToken, "oi");
    const msgs = await prisma.aiMessage.findMany({ where: { ownerId: u.userId } });
    expect(msgs.length).toBe(2);
    expect(msgs.some((m) => m.role === "assistant")).toBe(true);
  });
});
