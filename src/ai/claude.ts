import Anthropic from "@anthropic-ai/sdk";
import { CHAT_SYSTEM, DIARY_SYSTEM, parseDiaryJson } from "./prompts";

// Provedor opcional Claude (Anthropic). Ativa-se SÓ quando há ANTHROPIC_API_KEY.
// Só gera texto (respostas e análise de diário); nunca cria/altera registros.
// Qualquer falha retorna null, e quem chama usa o próximo provedor ou o motor local.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT || "low") as "low" | "medium" | "high";

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function isClaudeEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function firstText(msg: Anthropic.Message): string {
  for (const block of msg.content) if (block.type === "text") return block.text.trim();
  return "";
}

export async function claudeChat(contextText: string, userText: string): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const msg = await c.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: EFFORT },
      system: CHAT_SYSTEM,
      messages: [
        { role: "user", content: `CONTEXTO (dados do usuário):\n${contextText}\n\nPergunta do usuário:\n${userText}` },
      ],
    });
    return firstText(msg) || null;
  } catch {
    return null;
  }
}

export async function claudeDiary(
  text: string,
): Promise<{ title: string; summary: string; mood: string } | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const msg = await c.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: { effort: EFFORT },
      system: DIARY_SYSTEM,
      messages: [{ role: "user", content: `Relato:\n${text}` }],
    });
    return parseDiaryJson(firstText(msg));
  } catch {
    return null;
  }
}
