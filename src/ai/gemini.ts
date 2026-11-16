import { CHAT_SYSTEM, DIARY_SYSTEM, parseDiaryJson } from "./prompts";

// Provedor opcional Gemini (Google). Ativa-se SÓ quando há GEMINI_API_KEY.
// Usa a API REST do Google AI (camada gratuita com os modelos Flash). Só gera texto;
// nunca cria/altera registros. Qualquer falha retorna null (quem chama faz o fallback).

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type GenConfig = { maxOutputTokens: number; temperature?: number; responseMimeType?: string };

async function generate(system: string, userText: string, gen: GenConfig): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: gen,
      }),
      // Evita travar a resposta do app se o Google demorar.
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    const text = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("").trim();
    return text || null;
  } catch {
    return null;
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
