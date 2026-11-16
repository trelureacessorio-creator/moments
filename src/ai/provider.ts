// Seleciona o provedor de IA disponível, com fallback em cascata:
//   Gemini (grátis) → Claude → null (o motor determinístico assume).
// Preferimos o Gemini por ter camada gratuita; se não houver chave dele, tenta o Claude.
import { isGeminiEnabled, geminiChat, geminiDiary } from "./gemini";
import { isClaudeEnabled, claudeChat, claudeDiary } from "./claude";

export function aiEnabled(): boolean {
  return isGeminiEnabled() || isClaudeEnabled();
}

export async function aiChat(contextText: string, userText: string): Promise<string | null> {
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
