import { buildServer } from "../src/server";
import { prisma, ensureRevSequence } from "../src/db";

const TABLES = [
  "Session", "Share", "ChangeLog", "Preference", "Appointment", "Task", "Goal",
  "GoalStep", "GoalHistory", "Habit", "HabitLog", "FinanceNote", "FileItem", "FileBlob",
  "DiaryEntry", "Dream", "Idea", "ImportantPerson", "Dependent", "Notification",
  "AiMessage", "Retrospective", "User",
];

export async function resetDb() {
  await ensureRevSequence();
  await prisma.$executeRawUnsafe("ALTER SEQUENCE moments_rev RESTART WITH 1");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}

export function makeApp() {
  return buildServer();
}

export async function register(
  app: ReturnType<typeof buildServer>,
  email: string,
  name = "Pessoa",
  password = "password123"
) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, name, password },
  });
  if (res.statusCode !== 201) throw new Error(`register falhou: ${res.body}`);
  const body = res.json() as any;
  return {
    email,
    userId: body.user.id as string,
    accessToken: body.accessToken as string,
    refreshToken: body.refreshToken as string,
  };
}

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}
