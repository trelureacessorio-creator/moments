import Anthropic from "@anthropic-ai/sdk";

// Ponte opcional para o Claude (Anthropic). Ativa-se SÓ quando há ANTHROPIC_API_KEY.
// Princípios:
//  - Fundamentado: o modelo responde a partir de um resumo real dos dados do usuário.
//    Nunca inventa compromissos, valores ou fatos; se não está no contexto, é honesto.
//  - Nunca cria/altera nada: toda escrita continua sendo uma SUGESTÃO que o usuário
//    confirma no app. Este módulo só gera texto (respostas e análise de diário).
//  - Resiliente: qualquer falha retorna null, e quem chama usa o motor determinístico.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
// Esforço baixo: assistente de conversa precisa ser rápido e barato.
const EFFORT = (process.env.ANTHROPIC_EFFORT || "low") as "low" | "medium" | "high";

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente
  return client;
}

export function isClaudeEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function firstText(msg: Anthropic.Message): string {
  for (const block of msg.content) if (block.type === "text") return block.text.trim();
  return "";
}

const CHAT_SYSTEM = [
  "Você é o assistente pessoal do Moments, um app de organização de vida e família.",
  "Fale em português do Brasil, de forma calorosa, breve e objetiva.",
  "Responda SOMENTE com base no CONTEXTO fornecido (dados reais do usuário).",
  "Nunca invente compromissos, tarefas, metas ou valores. Se a informação não estiver",
  "no contexto, diga com honestidade que não encontrou e ofereça ajuda.",
  "Você NÃO cria nem altera nada: quando o usuário quiser registrar algo, o próprio app",
  "mostra uma sugestão para ele confirmar. Não diga que salvou/agendou/registrou algo.",
  "Não invente links nem dados pessoais.",
].join(" ");

// Resposta de conversa fundamentada nos dados do usuário. Retorna null em qualquer falha.
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
    const text = firstText(msg);
    return text || null;
  } catch {
    return null;
  }
}

const MOODS = ["Gratidão", "Alegria", "Cansaço", "Ansiedade", "Tristeza", "Tranquilidade", "Neutro"];

const DIARY_SYSTEM = [
  "Você ajuda a organizar o diário pessoal do Moments (português do Brasil).",
  "Dado um relato, gere um JSON com exatamente estas chaves:",
  '"title" (título curto, até ~44 caracteres, sem ponto final),',
  '"summary" (resumo em 1 frase, até ~160 caracteres),',
  `"mood" (um destes exatamente: ${MOODS.join(", ")}).`,
  "Baseie-se apenas no texto do relato; não invente fatos. Responda SÓ com o JSON, sem comentários.",
].join(" ");

// Análise de diário via Claude. Retorna null em qualquer falha (quem chama usa o motor local).
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
    const raw = firstText(msg);
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { title?: unknown; summary?: unknown; mood?: unknown };
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const mood = typeof parsed.mood === "string" && MOODS.includes(parsed.mood) ? parsed.mood : "Neutro";
    if (!title || !summary) return null;
    return { title, summary, mood };
  } catch {
    return null;
  }
}
