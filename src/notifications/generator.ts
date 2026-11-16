import { prisma, nextRev } from "../db";
import { sendPushToUser } from "../push/service";

// Gera as notificações "vencidas" até o instante `now`, respeitando o fuso e os
// horários de cada usuário. Idempotente: a mesma notificação (dedupeKey) nunca é
// criada duas vezes. Pensado para rodar a cada minuto (ver o agendador em index.ts).

interface LocalParts {
  date: string; // YYYY-MM-DD no fuso do usuário
  time: string; // HH:MM (24h)
  weekday: string; // Sun, Mon, ...
}

function localParts(now: Date, tz: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: get("weekday"),
  };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

async function ensure(
  ownerId: string,
  type: string,
  dedupeKey: string,
  now: Date,
  message: () => Promise<string> | string,
  extra: Record<string, any> = {}
): Promise<number> {
  const exists = await prisma.notification.findUnique({ where: { dedupeKey } });
  if (exists) return 0;
  const msg = await message();
  await prisma.notification.create({
    data: {
      ownerId, type, dedupeKey,
      message: msg,
      scheduledAt: now, status: "sent", sentAt: now,
      rev: await nextRev(),
      ...extra,
    },
  });
  // Dispara o push para os dispositivos do usuário (não bloqueia a geração).
  void sendPushToUser(ownerId, { title: "Moments", body: msg, url: "/", tag: type }).catch(() => {});
  return 1;
}

async function morningMessage(uid: string, date: string): Promise<string> {
  const [appts, tasks] = await Promise.all([
    prisma.appointment.count({ where: { ownerId: uid, date, deletedAt: null } }),
    prisma.task.count({ where: { ownerId: uid, done: false, deletedAt: null } }),
  ]);
  return `Bom dia! Você tem ${appts} compromisso${appts !== 1 ? "s" : ""} e ${tasks} tarefa${tasks !== 1 ? "s" : ""} para hoje.`;
}

async function nightMessage(uid: string): Promise<string> {
  const tasks = await prisma.task.count({ where: { ownerId: uid, done: false, deletedAt: null } });
  return tasks
    ? `Conferência noturna: você ainda tem ${tasks} tarefa${tasks !== 1 ? "s" : ""} pendente${tasks !== 1 ? "s" : ""}.`
    : "Conferência noturna: tudo concluído por hoje. ✨";
}

function goalMessage(g: any): string {
  let rem = "";
  if (g.targetValue != null) {
    rem = g.type === "money"
      ? `R$ ${(g.targetValue - g.currentValue).toLocaleString("pt-BR")}`
      : `${g.targetValue - g.currentValue} ${g.unit || ""}`.trim();
  }
  return `Faltam 10 dias para a meta "${g.name}".${rem ? ` Ainda faltam ${rem}.` : ""}`;
}

export async function generateDueNotifications(now: Date = new Date(), onlyUserId?: string): Promise<number> {
  let created = 0;
  const users = await prisma.user.findMany({
    where: onlyUserId ? { id: onlyUserId, status: "active" } : { status: "active" },
    select: { id: true },
  });

  for (const u of users) {
    // Boas-vindas: uma única vez por usuário (aparece mesmo com avisos desligados).
    created += await ensure(u.id, "welcome", `${u.id}:welcome`, now,
      () => "Bem-vindo(a) ao Moments! 🎉 Aqui chegam seus lembretes e avisos. Explore seu dia, suas metas, o diário e converse com o assistente.");

    const pref = await prisma.preference.findUnique({ where: { ownerId: u.id } });
    if (pref && pref.notifOn === false) continue;
    const tz = pref?.timezone || "America/Sao_Paulo";
    const { date, time, weekday } = localParts(now, tz);

    if (pref?.morning && time >= pref.morning) {
      created += await ensure(u.id, "morning", `${u.id}:morning:${date}`, now, () => morningMessage(u.id, date));
    }
    if (pref?.night && time >= pref.night) {
      created += await ensure(u.id, "night", `${u.id}:night:${date}`, now, () => nightMessage(u.id));
    }
    if (weekday === "Sun" && pref?.sunday && time >= pref.sunday) {
      created += await ensure(u.id, "sunday", `${u.id}:sunday:${date}`, now,
        () => "Planejamento da semana: veja seus compromissos e metas dos próximos 7 dias.");
    }

    const goals = await prisma.goal.findMany({
      where: { ownerId: u.id, deletedAt: null, status: { not: "done" } },
    });
    for (const g of goals) {
      const d = daysBetween(date, g.deadline);
      const incompleta = g.targetValue == null || g.currentValue < g.targetValue;
      if (d === 10 && incompleta) {
        created += await ensure(u.id, "goal_alert", `${u.id}:goal:${g.id}:${g.deadline}`, now,
          () => goalMessage(g), { entityType: "goals", entityId: g.id });
      }
    }

    // Lembretes de hora: 5 minutos antes e quando começa (compromissos e tarefas de hoje).
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
    const nowMin = toMin(time);

    const appts = await prisma.appointment.findMany({
      where: { ownerId: u.id, deletedAt: null, date, status: { not: "done" } },
    });
    for (const a of appts) {
      if (!a.time) continue;
      const diff = toMin(a.time) - nowMin;
      const place = a.place ? ` — ${a.place}` : "";
      if (diff > 0 && diff <= 5) {
        created += await ensure(u.id, "appt_soon", `${u.id}:apptsoon:${a.id}:${date}`, now,
          () => `Faltam ${diff} min para "${a.title}" às ${a.time}${place}.`, { entityType: "appointments", entityId: a.id });
      } else if (diff <= 0 && diff >= -10) {
        created += await ensure(u.id, "appt_now", `${u.id}:apptnow:${a.id}:${date}`, now,
          () => `Começou agora: "${a.title}" (${a.time})${place}.`, { entityType: "appointments", entityId: a.id });
      }
    }

    const tasks = await prisma.task.findMany({
      where: { ownerId: u.id, deletedAt: null, done: false, date },
    });
    for (const t of tasks) {
      if (!t.time) continue;
      const diff = toMin(t.time) - nowMin;
      if (diff > 0 && diff <= 5) {
        created += await ensure(u.id, "task_soon", `${u.id}:tasksoon:${t.id}:${date}`, now,
          () => `Faltam ${diff} min para a tarefa "${t.text}" (${t.time}).`, { entityType: "tasks", entityId: t.id });
      } else if (diff <= 0 && diff >= -10) {
        created += await ensure(u.id, "task_now", `${u.id}:tasknow:${t.id}:${date}`, now,
          () => `Hora da tarefa: "${t.text}" (${t.time}).`, { entityType: "tasks", entityId: t.id });
      }
    }
  }
  return created;
}
