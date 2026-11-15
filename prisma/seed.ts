import { prisma, ensureRevSequence, nextRev } from "../src/db";
import { hashPassword } from "../src/auth/password";

async function main() {
  await ensureRevSequence();

  const email = "mariana@email.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed já aplicada (usuário existe).");
    return;
  }

  const user = await prisma.user.create({
    data: { email, name: "Mariana", passwordHash: await hashPassword("password123") },
  });

  await prisma.preference.create({
    data: { ownerId: user.id, morning: "07:00", night: "20:00", sunday: "18:00", rev: await nextRev() },
  });

  await prisma.task.create({
    data: { ownerId: user.id, text: "Comprar fraldas", priority: "alta", done: false, date: "2026-11-15", rev: await nextRev() },
  });
  await prisma.appointment.create({
    data: { ownerId: user.id, title: "Consulta pediátrica", date: "2026-11-15", time: "14:00", place: "Clínica Vida", rev: await nextRev() },
  });
  await prisma.goal.create({
    data: { ownerId: user.id, name: "Economizar para a reserva", type: "money", targetValue: 5000, currentValue: 3200, startDate: "2026-09-15", deadline: "2026-11-25", rev: await nextRev() },
  });

  console.log(`Seed aplicada. Usuário: ${email} / senha: password123`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
