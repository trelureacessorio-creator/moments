import { CHAT_SYSTEM, DIARY_SYSTEM, parseDiaryJson } from "./prompts";

// Provedor opcional Gemini (Google). Ativa-se SÓ quando há GEMINI_API_KEY.
// Usa a API REST do Google AI (camada gratuita com os modelos Flash). Só gera texto;
// nunca cria/altera registros. Qualquer falha retorna null (quem chama faz o fallback).

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Lista de modelos tentados em ordem. Se GEMINI_MODEL for definido, usa só ele.
// Vários nomes dão robustez: se um foi descontinuado (404) ou está sobrecarregado
// (503), o próximo assume automaticamente.
const MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3.8-flash", "gemini-2.0-flash-001"];
// Status transitórios do Google (vale repetir) e "pular para o próximo modelo".
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const TRY_NEXT_MODEL = new Set([404, 429, 500, 502, 503, 504]);

export function isGeminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// POST a UM modelo, com reenvio em erro transitório. Retorna a Response (mesmo com
// erro, para diagnóstico) ou null se não houver chave / falha de rede nas tentativas.
async function postModel(model: string, body: object): Promise<Response | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const delays = [0, 600]; // tentativa imediata + 1 reenvio
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
      if (!TRANSIENT.has(res.status)) return res; // erro definitivo p/ este modelo
    } catch {
      last = null; // rede/timeout: tenta de novo
    }
  }
  return last;
}

// Percorre a lista de modelos e devolve a 1ª Response OK (e o modelo usado). Em erro
// que justifique trocar de modelo (404/5xx), tenta o próximo; outros erros param.
async function postGemini(body: object): Promise<{ res: Response | null; model: string }> {
  let lastRes: Response | null = null;
  let lastModel = MODELS[0];
  for (const model of MODELS) {
    const res = await postModel(model, body);
    lastModel = model;
    if (res && res.ok) return { res, model };
    lastRes = res;
    if (res && !TRY_NEXT_MODEL.has(res.status)) break; // erro definitivo (ex.: 400 chave)
  }
  return { res: lastRes, model: lastModel };
}

type GenConfig = { maxOutputTokens: number; temperature?: number; responseMimeType?: string };

async function generate(system: string, userText: string, gen: GenConfig): Promise<string | null> {
  try {
    const out = await postGemini({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: gen,
    });
    const res = out?.res;
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
  enabled: boolean; ok: boolean; status: number | null; model: string; tried: string[]; error: string | null;
}> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { enabled: false, ok: false, status: null, model: MODELS[0], tried: MODELS, error: "GEMINI_API_KEY ausente" };
  try {
    const out = await postGemini({ contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 5 } });
    const res = out?.res ?? null;
    const model = out?.model ?? MODELS[0];
    if (!res) return { enabled: true, ok: false, status: null, model, tried: MODELS, error: "sem resposta (rede/timeout)" };
    if (!res.ok) {
      let body = "";
      try { body = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      return { enabled: true, ok: false, status: res.status, model, tried: MODELS, error: body.replace(key, "***") || res.statusText };
    }
    return { enabled: true, ok: true, status: 200, model, tried: MODELS, error: null };
  } catch (e: any) {
    return { enabled: true, ok: false, status: null, model: MODELS[0], tried: MODELS, error: String(e?.message || e).slice(0, 200) };
  }
}

export async function geminiChat(contextText: string, userText: string): Promise<string | null> {
  const prompt = `CONTEXTO (dados do usuário):\n${contextText}\n\nPergunta do usuário:\n${userText}`;
  return generate(CHAT_SYSTEM, prompt, { maxOutputTokens: 1024, temperature: 0.6 });
}

export async function geminiDiary(
  text: string,
): Promise<{ title: string; summary: string; mood: string } | null> {
  const raw = await generate(DIARY_SYSTEM, `Relato:\n${text}`, {
    maxOutputTokens: 512,
    temperature: 0.2,
    responseMimeType: "application/json",
  });
  return raw ? parseDiaryJson(raw) : null;
}
