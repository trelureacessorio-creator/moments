import { z } from "zod";

/**
 * Registro das coleções sincronizáveis.
 * - delegate: nome do modelo no Prisma Client (prisma[delegate]).
 * - schema: campos graváveis pelo cliente (todos opcionais → upsert parcial).
 *   Campos de sistema (id, ownerId, rev, createdAt, updatedAt, deletedAt) nunca
 *   são aceitos do cliente: são controlados pelo servidor.
 */
export interface CollectionConfig {
  delegate: string;
  schema: z.ZodObject<any>;
  encrypted?: string[]; // campos criptografados em repouso (cifrados no push, decifrados no pull)
}

const str = z.string();
const bool = z.boolean();
const num = z.number();
const strArr = z.array(z.string());

export const registry: Record<string, CollectionConfig> = {
  preferences: {
    delegate: "preference",
    schema: z.object({
      priorities: strArr,
      morning: str.nullable(),
      night: str.nullable(),
      sunday: str.nullable(),
      timezone: str,
      notifOn: bool,
      aiEnabled: bool,
    }).partial(),
  },
  appointments: {
    delegate: "appointment",
    schema: z.object({
      title: str,
      date: str,
      time: str,
      endTime: str.nullable(),
      place: str.nullable(),
      notes: str.nullable(),
      participantIds: strArr,
      status: str,
    }).partial(),
  },
  tasks: {
    delegate: "task",
    schema: z.object({
      text: str,
      date: str.nullable(),
      time: str.nullable(),
      priority: str.nullable(),
      done: bool,
      doneAt: str.nullable(),
      goalId: str.nullable(),
    }).partial(),
  },
  goals: {
    delegate: "goal",
    schema: z.object({
      name: str,
      description: str.nullable(),
      type: str,
      targetValue: num.nullable(),
      currentValue: num,
      unit: str.nullable(),
      startDate: str,
      deadline: str,
      status: str,
    }).partial(),
  },
  goalSteps: {
    delegate: "goalStep",
    schema: z.object({
      goalId: str,
      text: str,
      done: bool,
      deadline: str.nullable(),
      doneAt: str.nullable(),
    }).partial(),
  },
  goalHistory: {
    delegate: "goalHistory",
    schema: z.object({
      goalId: str,
      date: str,
      value: num.nullable(),
      note: str.nullable(),
      source: str,
    }).partial(),
  },
  habits: {
    delegate: "habit",
    schema: z.object({
      name: str,
      frequency: str,
      objective: str.nullable(),
      durationTarget: num.nullable(),
      startDate: str,
      status: str,
    }).partial(),
  },
  habitLogs: {
    delegate: "habitLog",
    schema: z.object({
      habitId: str,
      date: str,
      done: bool,
      duration: num.nullable(),
      note: str.nullable(),
      mood: str.nullable(),
    }).partial(),
  },
  financeNotes: {
    delegate: "financeNote",
    schema: z.object({
      date: str,
      amount: num,
      type: str,
      category: str.nullable(),
      description: str.nullable(),
      goalId: str.nullable(),
      receiptFileId: str.nullable(),
    }).partial(),
  },
  files: {
    delegate: "fileItem",
    schema: z.object({
      name: str,
      fileType: str,
      docDate: str.nullable(),
      description: str.nullable(),
      category: str.nullable(),
      storageKey: str.nullable(),
      privacy: str,
    }).partial(),
  },
  diary: {
    delegate: "diaryEntry",
    // O relato (text) é criptografado em repouso — nem o banco guarda em texto puro.
    encrypted: ["text"],
    schema: z.object({
      date: str,
      time: str,
      title: str,
      text: str.nullable(),
      summary: str.nullable(),
      mood: str.nullable(),
      audioKey: str.nullable(),
      photoKeys: strArr,
      personIds: strArr,
    }).partial(),
  },
  dreams: {
    delegate: "dream",
    schema: z.object({
      type: str,
      title: str,
      description: str.nullable(),
      date: str,
      goalId: str.nullable(),
    }).partial(),
  },
  ideas: {
    delegate: "idea",
    schema: z.object({
      title: str,
      description: str.nullable(),
      date: str,
      category: str.nullable(),
      goalId: str.nullable(),
    }).partial(),
  },
  people: {
    delegate: "importantPerson",
    schema: z.object({
      name: str,
      nickname: str.nullable(),
      relation: str.nullable(),
      birthday: str.nullable(),
      phone: str.nullable(),
      howMet: str.nullable(),
      notes: str.nullable(),
    }).partial(),
  },
  dependents: {
    delegate: "dependent",
    schema: z.object({
      name: str,
      birthdate: str.nullable(),
      guardianIds: strArr,
      notes: str.nullable(),
    }).partial(),
  },
  notifications: {
    delegate: "notification",
    schema: z.object({
      type: str,
      entityType: str.nullable(),
      entityId: str.nullable(),
      message: str,
      scheduledAt: z.coerce.date(),
      status: str,
      sentAt: z.coerce.date().nullable(),
      readAt: z.coerce.date().nullable(),
    }).partial(),
  },
  aiMessages: {
    delegate: "aiMessage",
    schema: z.object({
      role: str,
      text: str,
      audioKey: str.nullable(),
      confirmed: bool.nullable(),
    }).partial(),
  },
  retrospectives: {
    delegate: "retrospective",
    schema: z.object({
      periodStart: str,
      periodEnd: str,
      type: str,
      summary: str.nullable(),
      data: z.any(),
    }).partial(),
  },
};

export const collectionNames = Object.keys(registry);
