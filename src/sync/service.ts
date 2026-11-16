import { prisma, nextRev } from "../db";
import { registry, collectionNames } from "./registry";
import { encryptField, decryptField } from "../crypto/fields";

type Row = Record<string, any>;

const SYSTEM_FIELDS = new Set([
  "id",
  "ownerId",
  "rev",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

function delegateFor(collection: string): any {
  const cfg = registry[collection];
  if (!cfg) throw new Error(`unknown_collection:${collection}`);
  return (prisma as any)[cfg.delegate];
}

/**
 * PULL — devolve tudo que mudou desde `cursor`:
 * registros do próprio usuário e registros compartilhados com ele (incl. tombstones).
 */
export async function pull(uid: string, cursor: number, only?: string[]) {
  const collections = (only ?? collectionNames).filter((c) => registry[c]);
  const changes: Record<string, Row[]> = {};
  let maxRev = cursor;

  // Itens compartilhados com o usuário, agrupados por coleção.
  const shares = await prisma.share.findMany({
    where: { recipientId: uid, status: "active" },
    select: { entityType: true, entityId: true },
  });
  const sharedIds: Record<string, string[]> = {};
  for (const s of shares) {
    (sharedIds[s.entityType] ??= []).push(s.entityId);
  }

  for (const name of collections) {
    const delegate = delegateFor(name);
    const owned: Row[] = await delegate.findMany({
      where: { ownerId: uid, rev: { gt: cursor } },
    });
    const ids = sharedIds[name] ?? [];
    const shared: Row[] = ids.length
      ? await delegate.findMany({ where: { id: { in: ids }, rev: { gt: cursor } } })
      : [];

    const byId = new Map<string, Row>();
    for (const r of [...owned, ...shared]) byId.set(r.id, r);
    const rows = [...byId.values()];
    if (rows.length) {
      // Decifra os campos criptografados antes de enviar ao cliente.
      const enc = registry[name].encrypted;
      if (enc?.length) {
        for (const r of rows) {
          for (const f of enc) if (typeof r[f] === "string") r[f] = await decryptField(r[f]);
        }
      }
      changes[name] = rows;
      for (const r of rows) if (r.rev > maxRev) maxRev = r.rev;
    }
  }

  return { changes, cursor: maxRev };
}

interface PushChange {
  id: string;
  deleted?: boolean;
  baseRev?: number;
  [field: string]: any;
}

/**
 * PUSH — aplica mudanças do cliente (upsert / exclusão lógica), resolvendo autorização
 * (dono ou editor autorizado), registrando conflitos (última escrita vence) e gerando
 * histórico de alterações quando um terceiro edita um item compartilhado.
 */
export async function push(
  uid: string,
  incoming: Record<string, PushChange[]>
) {
  const applied: { collection: string; id: string; rev: number }[] = [];
  const conflicts: { collection: string; id: string; server: Row }[] = [];
  const rejected: { collection: string; id: string; reason: string }[] = [];
  const actor = await prisma.user.findUnique({ where: { id: uid }, select: { name: true } });

  for (const [name, list] of Object.entries(incoming)) {
    const cfg = registry[name];
    if (!cfg) {
      for (const c of list) rejected.push({ collection: name, id: c?.id, reason: "unknown_collection" });
      continue;
    }
    const delegate = delegateFor(name);

    for (const change of list) {
      try {
        const { id, deleted, baseRev, ...rawFields } = change;
        if (!id) {
          rejected.push({ collection: name, id, reason: "missing_id" });
          continue;
        }

        const fields: Row = cfg.schema.parse(
          Object.fromEntries(Object.entries(rawFields).filter(([k]) => !SYSTEM_FIELDS.has(k)))
        );

        // Cifra os campos sensíveis antes de salvar (texto puro nunca toca o banco).
        if (cfg.encrypted?.length) {
          for (const f of cfg.encrypted) {
            if (typeof fields[f] === "string") fields[f] = await encryptField(fields[f]);
          }
        }

        const existing: Row | null = await delegate.findUnique({ where: { id } });

        // Autorização.
        let ownerId: string;
        if (existing) {
          if (existing.ownerId === uid) {
            ownerId = uid;
          } else {
            const share = await prisma.share.findFirst({
              where: {
                entityType: name,
                entityId: id,
                recipientId: uid,
                status: "active",
                permission: "editar",
              },
            });
            if (!share) {
              rejected.push({ collection: name, id, reason: "forbidden" });
              continue;
            }
            ownerId = existing.ownerId; // o dono não muda
          }
          if (baseRev != null && existing.rev > baseRev) {
            conflicts.push({ collection: name, id, server: existing });
          }
        } else {
          ownerId = uid; // criar sempre sob o próprio usuário
        }

        const rev = await nextRev();

        if (deleted) {
          if (existing) {
            await delegate.update({ where: { id }, data: { deletedAt: new Date(), rev } });
            if (existing.ownerId !== uid) {
              await logChange(name, id, existing.ownerId, uid, "deleted", "", "");
              await notifyOwner(existing.ownerId, name, id, titleOf(existing), actor?.name, "excluiu");
            }
          }
          applied.push({ collection: name, id, rev });
          continue;
        }

        if (existing) {
          if (existing.ownerId !== uid) {
            await logChanges(name, id, existing.ownerId, uid, existing, fields);
            await notifyOwner(existing.ownerId, name, id, titleOf(existing), actor?.name, "alterou");
          }
          await delegate.update({ where: { id }, data: { ...fields, rev, deletedAt: null } });
        } else {
          await delegate.create({ data: { id, ownerId, ...fields, rev } });
        }
        applied.push({ collection: name, id, rev });
      } catch (err: any) {
        rejected.push({
          collection: name,
          id: change?.id,
          reason: err?.code === "P2002" ? "conflict" : "invalid",
        });
      }
    }
  }

  const cursor = applied.reduce((m, a) => Math.max(m, a.rev), 0);
  return { applied, conflicts, rejected, cursor };
}

function titleOf(rec: Row): string {
  return rec.title || rec.text || rec.name || "um item";
}

// Avisa o dono quando um terceiro autorizado altera/exclui um item compartilhado.
async function notifyOwner(
  ownerId: string,
  entityType: string,
  entityId: string,
  title: string,
  actorName: string | undefined,
  verb: string
) {
  await prisma.notification
    .create({
      data: {
        ownerId,
        type: "shared_change",
        message: `${actorName || "Alguém"} ${verb} "${title}"`,
        entityType,
        entityId,
        dedupeKey: `${ownerId}:shared:${entityId}:${Date.now()}:${Math.random()}`,
        scheduledAt: new Date(),
        status: "sent",
        sentAt: new Date(),
        rev: await nextRev(),
      },
    })
    .catch(() => {});
}

async function logChange(
  entityType: string,
  entityId: string,
  ownerId: string,
  actorId: string,
  field: string,
  before: string,
  after: string
) {
  await prisma.changeLog.create({
    data: { entityType, entityId, ownerId, actorId, field, before, after },
  });
}

async function logChanges(
  entityType: string,
  entityId: string,
  ownerId: string,
  actorId: string,
  before: Row,
  after: Record<string, any>
) {
  for (const [k, v] of Object.entries(after)) {
    const prev = before[k];
    if (String(prev ?? "") !== String(v ?? "")) {
      await logChange(entityType, entityId, ownerId, actorId, k, String(prev ?? ""), String(v ?? ""));
    }
  }
}
