import { prisma } from "../db";
import { aiEnabled, aiChat, aiDiary } from "./provider";

// Motor de inteligência do Moments (Fase 3).
// - Responde perguntas APENAS a partir dos dados do próprio usuário (fundamentado).
// - Ao identificar uma intenção de criar/registrar, devolve uma SUGESTÃO estruturada;
//   nada é criado aqui — a confirmação acontece no cliente, via sincronização.
//
// Implementação determinística (sem dependência externa), suficiente para a busca e o
// assistente. Quando há GROQ_API_KEY, as perguntas abertas e a análise do diário são
// delegadas ao provedor de IA (Groq) via `./provider`, sempre com fallback para cá.

export interface Suggestion {
  collection: string; // coleção do sync (ex.: "appointments")
  kind: string; // rótulo curto do tipo
  label: string; // descrição amigável do que será criado
  fields: Record<string, any>; // campos prontos para createRecord no cliente
}
export interface AiResult {
  reply: string;
  suggestion?: Suggestion;
}

function localParts(now: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  });
  const g = (t: string) => fmt.formatToParts(now).find((p) => p.type === t)?.value || "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, weekday: g("weekday") };
}
function addDaysIso(d: string, n: number) {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
function brMoney(n: number) {
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function relDate(target: string, today: string) {
  const diff = Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `em ${target.split("-").reverse().slice(0, 2).join("/")}`;
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------- interpretação de intenção de criação ----------
function cleanTitle(t: string) {
  // Evita \b junto a letras acentuadas (JS trata acento como não-palavra): usa espaços.
  let s = " " + t.trim().replace(/[.!?]+$/, "") + " ";
  s = s.replace(/^\s*(eu\s+)?(marque|marca|marcar|agende|agenda|agendar|anote|anota|anotar|crie|cria|criar|adicione|adiciona|adicionar|lembre|lembra|lembrar|tenho|preciso|quero|vou|tive)(\s+de)?\s+/i, " ");
  s = s.replace(/\s(uma\s+)?(ideia|idéia)[:\s]+/i, " ");
  s = s.replace(/\s\d{1,2}\s*[:h]\s*\d{2}(\s|$)/g, " ");
  s = s.replace(/\s(à|a)s?\s*\d{1,2}\s*h?(\s|$)/gi, " ");
  s = s.replace(/\s(hoje|amanhã|depois de amanhã)(\s|$)/gi, " ");
  s = s.replace(/\s(domingo|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado)(-feira)?(\s|$)/gi, " ");
  s = s.replace(/\s{2,}/g, " ").replace(/[\s,.;]+$/, "").trim();
  return cap(s || t.trim());
}

function parseSuggestion(text: string, today: string): Suggestion | null {
  const low = text.toLowerCase();

  // dinheiro
  const m = low.match(/(economizei|guardei|poupei|gastei|paguei|recebi|ganhei)\b[^0-9]*(\d+[.,]?\d*)/);
  if (m) {
    const amount = parseFloat(m[2].replace(".", "").replace(",", "."));
    const type = /economizei|guardei|poupei/.test(m[1]) ? "economia" : /recebi|ganhei/.test(m[1]) ? "receita" : "despesa";
    return {
      collection: "financeNotes", kind: type,
      label: `${type === "economia" ? "Economia" : type === "receita" ? "Receita" : "Despesa"} de ${brMoney(amount)}`,
      fields: { type, amount, date: today },
    };
  }

  // data
  let date = today;
  if (/depois de amanhã/.test(low)) date = addDaysIso(today, 2);
  else if (/amanhã/.test(low)) date = addDaysIso(today, 1);

  // hora
  let time: string | null = null;
  const mt = low.match(/(\d{1,2})\s*[:h]\s*(\d{2})/) || low.match(/(?:às|as)\s*(\d{1,2})\s*h?/) || low.match(/(\d{1,2})\s*h\b/);
  if (mt) { const hh = ("0" + mt[1]).slice(-2); const mm = mt[2] ? mt[2] : "00"; if (+hh < 24) time = `${hh}:${mm}`; }

  const isAppt = /consulta|médico|medico|dentista|reunião|reuniao|encontro|aniversário|aniversario|exame|vacina|entrevista|compromisso/.test(low);
  const isIdea = /\b(ideia|idéia)\b/.test(low);
  const wantsCreate = /^(marque|marca|agende|agenda|anote|anota|crie|cria|adicione|adiciona|lembre|lembra)\b/.test(low);
  const title = cleanTitle(text);

  if (isIdea) return { collection: "ideas", kind: "ideia", label: `Nova ideia: ${title}`, fields: { title, date: today } };
  if (isAppt || time) return { collection: "appointments", kind: "compromisso", label: `Novo compromisso: ${title} (${relDate(date, today)}${time ? " às " + time : ""})`, fields: { title, date, time: time || "09:00", status: "scheduled" } };
  if (wantsCreate) return { collection: "tasks", kind: "tarefa", label: `Nova tarefa: ${title}`, fields: { text: title, done: false, date: today } };
  return null;
}

// ---------- diário inteligente: título, resumo e sentimento ----------
const MOOD_RULES: [RegExp, string][] = [
  [/grat[oa]|agradec|aben[çc]oad/i, "Gratidão"],
  [/feliz|alegr|ótim|otim|maravilh|radiante|content|divertid|empolgad/i, "Alegria"],
  [/cansad|exaust|esgotad|sem energia|sem f[oô]lego/i, "Cansaço"],
  [/ansios|preocupad|nervos|estress|tens[ãa]|apreensiv|aflit/i, "Ansiedade"],
  [/trist|chatead|desanim|sozinh|chor|magoad|frustrad|abatid/i, "Tristeza"],
  [/calm|tranquil|\bpaz\b|seren|aliviad|relax/i, "Tranquilidade"],
];

export function detectMood(text: string): string {
  for (const [re, label] of MOOD_RULES) if (re.test(text)) return label;
  return "Neutro";
}

export function analyzeDiary(text: string): { title: string; summary: string; mood: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  const first = clean.split(/(?<=[.!?])\s/)[0] || clean;
  let title = first.replace(/[.!?]+$/, "");
  if (title.length > 44) title = title.slice(0, 44).replace(/\s+\S*$/, "") + "…";
  title = cap(title) || "Meu relato";
  const summary = clean.length > 150 ? clean.slice(0, 147).replace(/\s+\S*$/, "") + "…" : clean;
  return { title, summary, mood: detectMood(clean) };
}

export async function analyzeDiaryFull(userId: string, text: string, now: Date = new Date()) {
  const pref = await prisma.preference.findUnique({ where: { ownerId: userId } });
  const tz = pref?.timezone || "America/Sao_Paulo";
  const { date: today } = localParts(now, tz);
  // Título/resumo/sentimento: tenta a IA (Groq) se o usuário permitir; senão, motor local.
  const useAi = aiEnabled() && pref?.aiEnabled !== false;
  const base = (useAi ? await aiDiary(text) : null) ?? analyzeDiary(text);
  // Extrai a sugestão da FRASE que contém o gatilho (não do relato inteiro),
  // para o título ficar limpo (ex.: "Consulta no dentista").
  let suggestion;
  for (const sent of text.split(/(?<=[.!?])\s+/)) {
    const s = parseSuggestion(sent, today);
    if (s) { suggestion = s; break; }
  }
  return { ...base, suggestion };
}

// ---------- contexto fundamentado para a IA ----------
// Monta um resumo compacto e REAL dos dados do usuário (nunca dados de terceiros),
// para o modelo responder com base nisso e jamais inventar.
async function buildUserContext(userId: string, today: string): Promise<string> {
  const monthStart = today.slice(0, 8) + "01";
  const tomorrow = addDaysIso(today, 1);
  const [appts, tasks, goals, savings, diary] = await Promise.all([
    prisma.appointment.findMany({ where: { ownerId: userId, deletedAt: null, status: { not: "done" }, date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 5 }),
    prisma.task.findMany({ where: { ownerId: userId, deletedAt: null, done: false, date: { in: [today, tomorrow] } }, take: 10 }),
    prisma.goal.findMany({ where: { ownerId: userId, deletedAt: null, status: { not: "done" } }, take: 8 }),
    prisma.financeNote.findMany({ where: { ownerId: userId, type: "economia", deletedAt: null, date: { gte: monthStart } } }),
    prisma.diaryEntry.findMany({ where: { ownerId: userId, deletedAt: null, mood: { not: null } }, orderBy: { date: "desc" }, take: 5 }),
  ]);
  const L: string[] = [`Hoje é ${today}.`];
  L.push(appts.length
    ? "Próximos compromissos: " + appts.map((a) => `${a.title} (${relDate(a.date, today)} às ${a.time}${a.place ? ", " + a.place : ""})`).join("; ") + "."
    : "Sem compromissos futuros registrados.");
  L.push(tasks.length
    ? "Tarefas pendentes (hoje/amanhã): " + tasks.map((t) => t.text).join("; ") + "."
    : "Sem tarefas pendentes para hoje ou amanhã.");
  L.push(goals.length
    ? "Metas em andamento: " + goals.map((g) => `${g.name}${g.targetValue != null ? ` (${Math.round((g.currentValue / (g.targetValue as number)) * 100)}%)` : ""}`).join("; ") + "."
    : "Sem metas em andamento.");
  const totalSaved = savings.reduce((a, n) => a + n.amount, 0);
  L.push(totalSaved > 0 ? `Economias registradas neste mês: ${brMoney(totalSaved)}.` : "Sem economias registradas neste mês.");
  if (diary.length) L.push("Sentimentos recentes no diário: " + diary.map((d) => d.mood).join(", ") + ".");
  return L.join("\n");
}

// ---------- respostas fundamentadas (busca nos dados do usuário) ----------
export async function interpret(userId: string, text: string, now: Date = new Date()): Promise<AiResult> {
  const pref = await prisma.preference.findUnique({ where: { ownerId: userId } });
  const tz = pref?.timezone || "America/Sao_Paulo";
  const { date: today } = localParts(now, tz);
  const low = text.toLowerCase().trim();

  // intenção de criação -> sugestão (sempre confirmada pelo usuário)
  if (/\b(marque|marca|agende|agenda|anote|anota|crie|cria|adicione|adiciona|lembre|lembra|economizei|guardei|poupei|gastei|paguei|recebi|ganhei)\b/.test(low)) {
    const s = parseSuggestion(text, today);
    if (s) return { reply: "Entendi — encontrei isto. Confira e confirme para eu registrar.", suggestion: s };
  }

  // quanto economizei neste mês
  if (/(economiz|poupe|guarde).*(m[êe]s)|quanto.*(economiz|poupe)/.test(low)) {
    const monthStart = today.slice(0, 8) + "01";
    const notes = await prisma.financeNote.findMany({ where: { ownerId: userId, type: "economia", deletedAt: null, date: { gte: monthStart } } });
    const total = notes.reduce((a, n) => a + n.amount, 0);
    return { reply: total > 0 ? `Este mês você registrou ${brMoney(total)} em economias. ✦` : "Ainda não há economias registradas neste mês." };
  }

  // próximo compromisso / consulta
  if (/(pr[óo]xim|quando).*(consulta|compromisso|reuni|médico|medico)|minha consulta|próximo compromisso/.test(low)) {
    const up = await prisma.appointment.findMany({ where: { ownerId: userId, deletedAt: null, status: { not: "done" }, date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 1 });
    const a = up[0];
    return { reply: a ? `Seu próximo compromisso é "${a.title}", ${relDate(a.date, today)} às ${a.time}${a.place ? ` (${a.place})` : ""}.` : "Não encontrei compromissos futuros na sua agenda." };
  }

  // quanto falta para a meta
  if (/(falta|quanto falta).*(meta|objetivo)|meta.*falta/.test(low)) {
    const goals = await prisma.goal.findMany({ where: { ownerId: userId, deletedAt: null, status: { not: "done" } } });
    const g = goals.find((x) => x.targetValue != null && x.currentValue < (x.targetValue as number));
    if (!g) return { reply: "Todas as suas metas já foram concluídas. Parabéns! 🎉" };
    const rem = g.type === "money" ? brMoney((g.targetValue as number) - g.currentValue) : `${(g.targetValue as number) - g.currentValue} ${g.unit || ""}`.trim();
    const pct = Math.round((g.currentValue / (g.targetValue as number)) * 100);
    return { reply: `Para a meta "${g.name}" faltam ${rem}. Você já fez ${pct}%. 💪` };
  }

  // quais metas
  if (/\bmetas?\b/.test(low) && /(quais|minhas|lista|como)/.test(low)) {
    const goals = await prisma.goal.findMany({ where: { ownerId: userId, deletedAt: null } });
    if (!goals.length) return { reply: "Você ainda não tem metas cadastradas." };
    const lines = goals.map((g) => `• ${g.name}${g.targetValue != null ? ` — ${Math.round((g.currentValue / (g.targetValue as number)) * 100)}%` : ""}`);
    return { reply: "Suas metas:\n" + lines.join("\n") };
  }

  // tarefas de hoje / amanhã
  if (/tarefa/.test(low)) {
    const day = /amanhã/.test(low) ? addDaysIso(today, 1) : today;
    const ts = await prisma.task.findMany({ where: { ownerId: userId, deletedAt: null, done: false, date: day } });
    const quando = /amanhã/.test(low) ? "amanhã" : "hoje";
    return { reply: ts.length ? `${cap(quando)} você tem:\n${ts.map((t) => "• " + t.text).join("\n")}` : `Nenhuma tarefa pendente para ${quando}. ✨` };
  }

  // saudações / cortesia
  if (/^(ol[áa]|oi|bom dia|boa tarde|boa noite|obrigad)/.test(low)) {
    return { reply: "Estou aqui para ajudar. Posso ver seus compromissos, tarefas, metas e economias — ou registrar algo (é só pedir)." };
  }

  // Sem correspondência exata: se a IA estiver ativa, responde fundamentado nos
  // dados do usuário; caso contrário (ou em falha), a resposta honesta do motor local.
  const fallback = "Ainda não encontrei isso nas suas informações. Posso ajudar com compromissos, tarefas, metas ou economias — ou peça para eu anotar algo (ex.: \"marque dentista amanhã às 9h\").";
  if (aiEnabled() && pref?.aiEnabled !== false) {
    const ctx = await buildUserContext(userId, today);
    const reply = await aiChat(ctx, text);
    if (reply) return { reply };
  }
  return { reply: fallback };
}
