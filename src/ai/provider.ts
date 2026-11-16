// Seleciona o provedor de IA disponível, com fallback em cascata:
//   Groq (grátis/estável) → Gemini (grátis) → Claude (pago) → null (motor local).
import { isGroqEnabled, groqChat, groqDiary, groqDiagnose } from "./groq";
import { isGeminiEnabled, geminiChat, geminiDiary, geminiDiagnose } from "./gemini";
import { isClaudeEnabled, claudeChat, claudeDiary } from "./claude";

export function aiEnabled(): boolean {
  return isGroqEnabled() || isGeminiEnabled() || isClaudeEnabled();
}

export async function aiChat(contextText: string, userText: string): Promise<string | null> {
  if (isGroqEnabled()) {
    const r = await groqChat(contextText, userText);
    if (r) return r;
  }
  if (isGeminiEnabled()) {
    const r = await geminiChat(contextText, userText);
    if (r) return r;
  }
  if (isClaudeEnabled()) {
    const r = await claudeChat(contextText, userText);
    if (r) return r;
  }
  return null;
}

export async function aiDiary(
  text: string,
): Promise<{ title: string; summary: string; mood: string } | null> {
  if (isGroqEnabled()) {
    const r = await groqDiary(text);
    if (r) return r;
  }
  if (isGeminiEnabled()) {
    const r = await geminiDiary(text);
    if (r) return r;
  }
  if (isClaudeEnabled()) {
    const r = await claudeDiary(text);
    if (r) return r;
  }
  return null;
}

// Diagnóstico agregado para o endpoint /ai/health.
export async function aiDiagnose() {
  return {
    groqEnabled: isGroqEnabled(),
    geminiEnabled: isGeminiEnabled(),
    claudeEnabled: isClaudeEnabled(),
    groq: isGroqEnabled() ? await groqDiagnose() : null,
    gemini: isGeminiEnabled() ? await geminiDiagnose() : null,
  };
}
