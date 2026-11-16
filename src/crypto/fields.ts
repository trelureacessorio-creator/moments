import crypto from "crypto";
import { prisma } from "../db";

// Criptografia de campos sensíveis em repouso (AES-256-GCM).
// A chave vem de ENCRYPTION_KEY (recomendado: definir no Render, FORA do banco).
// Se não houver, gera e guarda uma em AppConfig (proteção menor, mas melhor que texto puro).
// Formato guardado: "enc:v1:<base64(iv(12) + tag(16) + ciphertext)>".
// Valores sem o prefixo são tratados como texto legado (compatibilidade).

const PREFIX = "enc:v1:";
let keyCache: Buffer | null = null;

function normalizeKey(s: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  try { const b = Buffer.from(s, "base64"); if (b.length === 32) return b; } catch { /* ignore */ }
  return crypto.createHash("sha256").update(s).digest(); // deriva 32 bytes de qualquer string
}

async function getKey(): Promise<Buffer> {
  if (keyCache) return keyCache;
  const env = process.env.ENCRYPTION_KEY;
  if (env) { keyCache = normalizeKey(env); return keyCache; }
  const row = await prisma.appConfig.findUnique({ where: { key: "encKey" } });
  if (row) { keyCache = Buffer.from(row.value, "base64"); return keyCache; }
  const k = crypto.randomBytes(32);
  await prisma.appConfig.upsert({ where: { key: "encKey" }, update: { value: k.toString("base64") }, create: { key: "encKey", value: k.toString("base64") } });
  keyCache = k;
  return k;
}

export async function encryptField(plain: string | null | undefined): Promise<string | null | undefined> {
  if (plain == null || plain === "") return plain;
  if (typeof plain === "string" && plain.startsWith(PREFIX)) return plain; // já cifrado
  try {
    const key = await getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
  } catch {
    return plain; // em falha, não perde o dado (fica em texto)
  }
}

export async function decryptField(value: any): Promise<any> {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value; // legado/texto
  try {
    const key = await getKey();
    const raw = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    return value;
  }
}
