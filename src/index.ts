import { buildServer } from "./server";
import { ensureRevSequence, prisma } from "./db";
import { env } from "./env";
import { generateDueNotifications } from "./notifications/generator";

async function main() {
  await ensureRevSequence();
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`Moments API ouvindo em http://localhost:${env.PORT}`);

  // Agendador simples: verifica avisos vencidos a cada minuto.
  const tick = () => generateDueNotifications(new Date()).catch((e) => console.error("notif gen", e));
  void tick();
  setInterval(tick, 60_000).unref();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
