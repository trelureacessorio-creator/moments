// Prompts e utilidades compartilhados entre os provedores de IA (Claude, Gemini).
// Mantêm o mesmo comportamento fundamentado e a regra "sugere, não cria".

export const MOODS = ["Gratidão", "Alegria", "Cansaço", "Ansiedade", "Tristeza", "Tranquilidade", "Neutro"];

export const CHAT_SYSTEM = [
  "Você é o assistente pessoal do Moments, um app de organização de vida e família.",
  "Fale em português do Brasil, de forma calorosa, breve e objetiva.",
  "Responda SOMENTE com base no CONTEXTO fornecido (dados reais do usuário).",
  "Nunca invente compromissos, tarefas, metas ou valores. Se a informação não estiver",
  "no contexto, diga com honestidade que não encontrou e ofereça ajuda.",
  "Você NÃO cria nem altera nada: quando o usuário quiser registrar algo, o próprio app",
  "mostra uma sugestão para ele confirmar. Não diga que salvou/agendou/registrou algo.",
  "Não invente links nem dados pessoais.",
].join(" ");

export const DIARY_SYSTEM = [
  "Você ajuda a organizar o diário pessoal do Moments (português do Brasil).",
  "Dado um relato, gere um JSON com exatamente estas chaves:",
  '"title" (título curto, até ~44 caracteres, sem ponto final),',
  '"summary" (resumo em 1 frase, até ~160 caracteres),',
  `"mood" (um destes exatamente: ${MOODS.join(", ")}).`,
  "Baseie-se apenas no texto do relato; não invente fatos. Responda SÓ com o JSON, sem comentários.",
].join(" ");

// Extrai {title, summary, mood} de uma resposta (tolerante a texto ao redor do JSON).
export function parseDiaryJson(raw: string): { title: string; summary: string; mood: string } | null {
  try {
    const i = raw.indexOf("{");
    const j = raw.lastIndexOf("}");
    if (i < 0 || j < 0) return null;
    const parsed = JSON.parse(raw.slice(i, j + 1)) as { title?: unknown; summary?: unknown; mood?: unknown };
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const mood = typeof parsed.mood === "string" && MOODS.includes(parsed.mood) ? parsed.mood : "Neutro";
    if (!title || !summary) return null;
    return { title, summary, mood };
  } catch {
    return null;
  }
}
