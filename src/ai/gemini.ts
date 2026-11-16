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

// Lista os modelos que ESTA chave pode usar com generateContent (nomes sem "models/").
async function listModels(): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${BASE}?key=${encodeURIComponent(key)}&pageSize=200`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    const data: any = await res.json();
    const list: string[] = [];
    for (const m of data?.models ?? []) {
      const methods: string[] = m?.supportedGenerationMethods ?? [];
      if (methods.includes("generateContent") && typeof m?.name === "string") {
        list.push(m.name.replace(/^models\//, ""));
      }
    }
    return list;
  } catch {
    return [];
  }
}

// Diagnóstico completo: lista os modelos da chave e testa um a um os candidatos.
export async function geminiDiagnose(): Promise<{
  enabled: boolean; ok: boolean; workingModel: string | null; candidates: string[];
  availableModels: string[]; attempts: { model: string; status: number | null; error: string | null }[];
}> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { enabled: false, ok: false, workingModel: null, candidates: MODELS, availableModels: [], attempts: [] };
  }
  const availableModels = await listModels();
  // Testa os candidatos configurados e, por segurança, os primeiros modelos "flash" da conta.
  const extra = availableModels.filter((m) => /flash/i.test(m) && !MODELS.includes(m)).slice(0, 4);
  const toTry = [...MODELS, ...extra];
  const attempts: { model: string; status: number | null; error: string | null }[] = [];
  let workingModel: string | null = null;
  for (const model of toTry) {
    const res = await postModel(model, { contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 5 } });
    if (!res) { attempts.push({ model, status: null, error: "sem resposta" }); continue; }
    if (res.ok) { attempts.push({ model, status: 200, error: null }); workingModel = model; break; }
    let body = ""; try { body = (await res.text()).slice(0, 160); } catch { /* ignore */ }
    attempts.push({ model, status: res.status, error: body.replace(key, "***").replace(/\s+/g, " ").trim() || null });
  }
  return { enabled: true, ok: Boolean(workingModel), workingModel, candidates: MODELS, availableModels, attempts };
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
