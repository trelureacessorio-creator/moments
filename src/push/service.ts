import webpush from "web-push";
import { prisma } from "../db";

// Web Push: o servidor gera e guarda as chaves VAPID uma única vez (tabela AppConfig),
// então não é preciso configurar segredos manualmente. A chave PÚBLICA é entregue ao
// cliente; a PRIVADA nunca sai do servidor.

const SUBJECT = process.env.VAPID_SUBJECT || "mailto:no-reply@moments.app";
let configured: { publicKey: string } | null = null;

async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}
async function setConfig(key: string, value: string): Promise<void> {
  await prisma.appConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
}

// Garante que as chaves existem e configura o web-push. Idempotente.
export async function ensurePush(): Promise<{ publicKey: string } | null> {
  if (configured) return configured;
  try {
    let publicKey = process.env.VAPID_PUBLIC_KEY || (await getConfig("vapidPublic"));
    let privateKey = process.env.VAPID_PRIVATE_KEY || (await getConfig("vapidPrivate"));
    if (!publicKey || !privateKey) {
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      await setConfig("vapidPublic", publicKey);
      await setConfig("vapidPrivate", privateKey);
    }
    webpush.setVapidDetails(SUBJECT, publicKey, privateKey);
    configured = { publicKey };
    return configured;
  } catch {
    return null;
  }
}

export async function getPublicKey(): Promise<string | null> {
  const c = await ensurePush();
  return c?.publicKey ?? null;
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

// Envia um push para todos os dispositivos do usuário. Remove inscrições inválidas.
export async function sendPushToUser(ownerId: string, payload: PushPayload): Promise<void> {
  const c = await ensurePush();
  if (!c) return;
  const subs = await prisma.pushSubscription.findMany({ where: { ownerId } });
  if (!subs.length) return;
  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
        );
      } catch (e: any) {
        // 404/410 = inscrição expirada/cancelada: apaga.
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
      }
    }),
  );
}
