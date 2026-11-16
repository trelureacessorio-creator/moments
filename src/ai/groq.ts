import { CHAT_SYSTEM, DIARY_SYSTEM, parseDiaryJson } from "./prompts";

// Provedor opcional Groq (grátis, sem cartão; API compatível com OpenAI). Roda modelos
// Llama, bons em português. Ativa-se SÓ quando há GROQ_API_KEY. Só gera texto; nunca
// cria/altera registros. Qualquer falha retorna null (quem chama faz o fallback).

const BASE = "https://api.groq.com/openai/v1";
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
// Fallback caso a descoberta de modelos falhe.
const FALLBACK_MODEL = "llama-3.3-70b-versatile";

export function isGroqEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

let cachedModel: string | null = null;

// Escolhe um bom modelo de chat entre os ids disponíveis (evita áudio/guard/embed).
function pickChatModel(ids: string[]): string | null {
  const chat = ids.filter((id) => !/whisper|tts|embed|guard|moderation/i.test(id));
  return (
    chat.find((id) => /llama.*(3\.3|3-3).*70b|llama.*70b.*versatile/i.test(id)) ||
    chat.find((id) => /70b/i.test(id) && /llama/i.test(id)) ||
    chat.find((id) => /llama/i.test(id)) ||
    chat[0] ||
    null
  );
}

async function listModels(): Promise<string[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${BASE}/models`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data?.data ?? []).map((m: any) => m?.id).filter((x: any): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

async function resolveModel(): Promise<string> {
  if (process.env.GROQ_MODEL) return process.env.GROQ_MODEL;
  if (cachedModel) return cachedModel;
  const picked = pickChatModel(await listModels());
  cachedModel = picked || FALLBACK_MODEL;
  return cachedModel;
}

// POST chat/completions com reenvio em erro transitório. Retorna a Response ou null.
async function post(model: string, messages: object[], opts: { max_tokens: number; temperature?: number; json?: boolean }): Promise<Response | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const body: any = { model, messages, max_tokens: opts.max_tokens, temperature: opts.temperature ?? 0.6 };
  if (opts.json) body.response_format = { type: "json_object" };
  const delays = [0, 600];
  let last: Response | null = null;
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return res;
      last = res;
      if (!TRANSIENT.has(res.status)) return res;
    } catch {
      last = null;
    }
  }
  return last;
}

async function content(res: Response | null): Promise<string | null> {
  if (!res || !res.ok) return null;
  try {
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

export async function groqChat(contextText: string, userText: string): Promise<string | null> {
  const model = await resolveModel();
  const res = await post(model, [
    { role: "system", content: CHAT_SYSTEM },
    { role: "user", content: `CONTEXTO (dados do usuário):\n${contextText}\n\nPergunta do usuário:\n${userText}` },
  ], { max_tokens: 1024, temperature: 0.6 });
  return content(res);
}

export async function groqDiary(
  text: string,
): Promise<{ title: string; summary: string; mood: string } | null> {
  const model = await resolveModel();
  const res = await post(model, [
    { role: "system", content: DIARY_SYSTEM },
    { role: "user", content: `Relato:\n${text}` },
  ], { max_tokens: 512, temperature: 0.2, json: true });
  const raw = await content(res);
  return raw ? parseDiaryJson(raw) : null;
}

// Diagnóstico: lista modelos da chave, escolhe um e faz um ping (sem expor a chave).
export async function groqDiagnose(): Promise<{
  enabled: boolean; ok: boolean; model: string | null; status: number | null; availableModels: string[]; error: string | null;
}> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { enabled: false, ok: false, model: null, status: null, availableModels: [], error: "GROQ_API_KEY ausente" };
  const availableModels = await listModels();
  const model = process.env.GROQ_MODEL || pickChatModel(availableModels) || FALLBACK_MODEL;
  try {
    const res = await post(model, [{ role: "user", content: "ping" }], { max_tokens: 5 });
    if (!res) return { enabled: true, ok: false, model, status: null, availableModels, error: "sem resposta (rede/timeout)" };
    if (!res.ok) {
      let body = ""; try { body = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      return { enabled: true, ok: false, model, status: res.status, availableModels, error: body.replace(/\s+/g, " ").trim() || res.statusText };
    }
    return { enabled: true, ok: true, model, status: 200, availableModels, error: null };
  } catch (e: any) {
    return { enabled: true, ok: false, model, status: null, availableModels, error: String(e?.message || e).slice(0, 200) };
  }
}
