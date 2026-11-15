import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { makeApp, resetDb, register, bearer } from "./helpers";
import { prisma } from "../src/db";

const app = makeApp();
beforeAll(async () => { await app.ready(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); });

describe("autenticação", () => {
  it("registra uma conta e devolve tokens", async () => {
    const res = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { email: "a@x.com", name: "Ana", password: "password123" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe("a@x.com");
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toContain(".");
  });

  it("recusa e-mail duplicado", async () => {
    await register(app, "a@x.com");
    const res = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { email: "a@x.com", name: "Outra", password: "password123" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("faz login e rejeita senha errada", async () => {
    await register(app, "a@x.com", "Ana", "password123");
    const ok = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "a@x.com", password: "password123" } });
    expect(ok.statusCode).toBe(200);
    const bad = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "a@x.com", password: "errada" } });
    expect(bad.statusCode).toBe(401);
  });

  it("protege rotas autenticadas", async () => {
    const u = await register(app, "a@x.com");
    const noTok = await app.inject({ method: "GET", url: "/auth/me" });
    expect(noTok.statusCode).toBe(401);
    const withTok = await app.inject({ method: "GET", url: "/auth/me", headers: bearer(u.accessToken) });
    expect(withTok.statusCode).toBe(200);
    expect(withTok.json().user.email).toBe("a@x.com");
  });

  it("rotaciona o refresh e invalida o antigo", async () => {
    const u = await register(app, "a@x.com");
    const r1 = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: u.refreshToken } });
    expect(r1.statusCode).toBe(200);
    const newRefresh = r1.json().refreshToken;
    expect(newRefresh).not.toBe(u.refreshToken);
    // O refresh antigo não vale mais.
    const reused = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: u.refreshToken } });
    expect(reused.statusCode).toBe(401);
  });

  it("encerra sessão (logout) e lista/revoga dispositivos", async () => {
    const u = await register(app, "a@x.com");
    const sessions = await app.inject({ method: "GET", url: "/auth/sessions", headers: bearer(u.accessToken) });
    expect(sessions.json().sessions.length).toBe(1);

    const out = await app.inject({ method: "POST", url: "/auth/logout", payload: { refreshToken: u.refreshToken } });
    expect(out.statusCode).toBe(200);
    const afterLogout = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: u.refreshToken } });
    expect(afterLogout.statusCode).toBe(401);
  });
});
