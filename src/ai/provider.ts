// Provedor de IA do Moments: Groq (grátis) com fallback para o motor determinístico.
// Sem chave do Groq (ou em qualquer falha), o motor local assume — o app nunca quebra.
import { isGroqEnabled, groqChat, groqDiary, groqDiagnose } from "./groq";

export function aiEnabled(): boolean {
  return isGroqEnabled();
}

export async function aiChat(contextText: string, userText: string): Promise<string | null> {
  if (isGroqEnabled()) return groqChat(contextText, userText);
  return null;
}

export async function aiDiary(
  text: string,
): Promise<{ title: string; summary: string; mood: string } | null> {
  if (isGroqEnabled()) return groqDiary(text);
  return null;
}

// Diagnóstico para o endpoint /ai/health.
export async function aiDiagnose() {
  return {
    groqEnabled: isGroqEnabled(),
    groq: isGroqEnabled() ? await groqDiagnose() : null,
  };
}
