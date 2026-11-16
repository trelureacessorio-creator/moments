import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { makeApp, resetDb, register, bearer } from "./helpers";
import { prisma } from "../src/db";

const app = makeApp();
beforeAll(async () => { await app.ready(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); });

describe("criptografia do diário", () => {
  it("guarda o relato cifrado no banco e devolve legível no pull", async () => {
    const u = await register(app, "a@x.com");
    const id = crypto.randomUUID();
    const relato = "Hoje foi um dia difícil, mas conversei com minha mãe e melhorei.";

    await app.inject({
      method: "POST", url: "/sync/push", headers: bearer(u.accessToken),
      payload: { changes: { diary: [{ id, date: "2026-11-16", time: "20:00", title: "Meu dia", text: relato }] } },
    });

    // No banco, o texto NÃO está em claro (começa com o marcador de cifra).
    const raw = await prisma.diaryEntry.findUnique({ where: { id } });
    expect(raw?.text).toBeTruthy();
    expect(raw?.text).not.toBe(relato);
    expect(raw?.text?.startsWith("enc:v1:")).toBe(true);

    // No pull, volta decifrado para o cliente.
    const res = await app.inject({ method: "POST", url: "/sync/pull", headers: bearer(u.accessToken), payload: { cursor: 0 } });
    const body = res.json();
    expect(body.changes.diary[0].text).toBe(relato);
  });
});
