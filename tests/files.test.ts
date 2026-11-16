import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { resetDb, makeApp, register, bearer } from "./helpers";
import { prisma } from "../src/db";

// Teste obrigatório nº 10: arquivos guardam e recuperam; e respeitam autorizações.
function multipart(content: Buffer, filename = "recibo.txt", type = "text/plain") {
  const boundary = "----momentsTestBoundary";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("arquivos (upload/download)", () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it("guarda o arquivo, recupera igual e bloqueia quem não tem acesso", async () => {
    const app = makeApp();
    await app.ready();
    const owner = await register(app, "dono@moments.app");
    const other = await register(app, "outro@moments.app");

    const item = await prisma.fileItem.create({
      data: { ownerId: owner.userId, name: "Recibo da farmácia", fileType: "comprovante", rev: 0 },
    });

    const content = Buffer.from("conteúdo do comprovante 123", "utf-8");
    const mp = multipart(content);

    // dono envia
    const up = await app.inject({
      method: "POST", url: `/files/${item.id}/upload`,
      headers: { ...bearer(owner.accessToken), ...mp.headers }, payload: mp.body,
    });
    expect(up.statusCode).toBe(200);
    expect(up.json().size).toBe(content.length);

    // dono recupera — bytes idênticos
    const get = await app.inject({ method: "GET", url: `/files/${item.id}/content`, headers: bearer(owner.accessToken) });
    expect(get.statusCode).toBe(200);
    expect(Buffer.compare(get.rawPayload, content)).toBe(0);

    // outro usuário NÃO acessa (sem compartilhamento)
    const denied = await app.inject({ method: "GET", url: `/files/${item.id}/content`, headers: bearer(other.accessToken) });
    expect(denied.statusCode).toBe(404);

    // outro usuário NÃO pode enviar para o arquivo do dono
    const forbidden = await app.inject({
      method: "POST", url: `/files/${item.id}/upload`,
      headers: { ...bearer(other.accessToken), ...mp.headers }, payload: mp.body,
    });
    expect(forbidden.statusCode).toBe(403);

    // com compartilhamento ativo, o outro passa a ler
    await prisma.share.create({
      data: { ownerId: owner.userId, recipientId: other.userId, entityType: "files", entityId: item.id, permission: "ver", status: "active" },
    });
    const shared = await app.inject({ method: "GET", url: `/files/${item.id}/content`, headers: bearer(other.accessToken) });
    expect(shared.statusCode).toBe(200);
    expect(Buffer.compare(shared.rawPayload, content)).toBe(0);

    // o FileItem passou a marcar que tem conteúdo (storageKey) para sincronizar
    const refreshed = await prisma.fileItem.findUnique({ where: { id: item.id } });
    expect(refreshed?.storageKey).toBe("db");

    await app.close();
  });
});
