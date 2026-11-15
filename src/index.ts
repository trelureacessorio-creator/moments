import { buildServer } from "./server";
import { ensureRevSequence, prisma } from "./db";
import { env } from "./env";

async function main() {
  await ensureRevSequence();
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  // eslint-disable-next-line no-console
  console.log(`Moments API ouvindo em http://localhost:${env.PORT}`);
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
