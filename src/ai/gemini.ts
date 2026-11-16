import { CHAT_SYSTEM, DIARY_SYSTEM, parseDiaryJson } from "./prompts";

// Provedor opcional Gemini (Google). Ativa-se SÓ quando há GEMINI_API_KEY.
// Usa a API REST do Google AI (camada gratuita com os modelos Flash). Só gera texto;
// nunca cria/altera registros. Qualquer falha retorna null (quem chama faz o fallback).

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Status transitórios do Google: vale repetir a chamada.
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

export function isGeminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// POST ao Gemini com novas tentativas em erros transitórios (sobrecarga/limite).
// Retorna a Response (mesmo com erro não-transitório, p/ diagnóstico) ou null se não há chave.
async function postGemini(body: object): Promise<Response | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `${BASE}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const delays = [0, 700, 1600]; // tentativa imediata + 2 reenvios com espera
  let last: Response | null = null;
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return res;
      last = res;
      if (!TRANSIENT.has(res.status)) return res; // erro definitivo: não insiste
    } catch {
      last = null; // rede/timeout: tenta de novo
    }
  }
  return last;
}

type GenConfig = { maxOutputTokens: number; temperature?: number; responseMimeType?: string };

async function generate(system: string, userText: string, gen: GenConfig): Promise<string | null> {
  try {
    const res = await postGemini({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: gen,
    });
    if (!res || !res.ok) return null;
    const data: any = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const text = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("").trim();
    return text || null;
  } catch {
    return null;
  }
}

// Diagnóstico: faz uma chamada mínima e devolve o resultado SEM expor a chave.
export async function geminiDiagnose(): Promise<{
  enabled: boolean; ok: boolean; status: number | null; model: string; error: string | null;
}> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { enabled: false, ok: false, status: null, model: MODEL, error: "GEMINI_API_KEY ausente" };
  try {
    const res = await postGemini({ contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 5 } });
    if (!res) return { enabled: true, ok: false, status: null, model: MODEL, error: "sem resposta (rede/timeout)" };
    if (!res.ok) {
      let body = "";
      try { body = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      return { enabled: true, ok: false, status: res.status, model: MODEL, error: body.replace(key, "***") || res.statusText };
    }
    return { enabled: true, ok: true, status: 200, model: MODEL, error: null };
  } catch (e: any) {
    return { enabled: true, ok: false, status: null, model: MODEL, error: String(e?.message || e).slice(0, 200) };
  }
}

export async function geminiChat(contextText: string, userText: string): Promise<string | null> {
  const prompt = `CONTEXTO (dados do usuário):\n${contextText}\n\nPergunta do usuário:\n${userText}`;
  return generate(CHAT_SYSTEM, prompt, { maxOutputTokens: 1024, temperature: 0.6 });
}

export async function geminiDiary(
  text: string,
): Promise<{ title: string; summary: string; mood: string } | null> {
  // responseMimeType JSON torna a saída estruturada e o parse confiável.
  const raw = await generate(DIARY_SYSTEM, `Relato:\n${text}`, {
    maxOutputTokens: 512,
    temperature: 0.2,
    responseMimeType: "application/json",
  });
  return raw ? parseDiaryJson(raw) : null;
}
