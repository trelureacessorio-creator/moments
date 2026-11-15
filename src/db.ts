import "./env";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Cria a sequência global usada para o `rev` do sync (idempotente). */
export async function ensureRevSequence(): Promise<void> {
  await prisma.$executeRawUnsafe(
    "CREATE SEQUENCE IF NOT EXISTS moments_rev START 1"
  );
}

/** Próximo valor de revisão global (monotônico). */
export async function nextRev(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ rev: number }[]>(
    "SELECT nextval('moments_rev')::int AS rev"
  );
  return rows[0].rev;
}
