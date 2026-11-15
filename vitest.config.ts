import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Os testes compartilham um único banco Postgres; rodam em série para
    // evitar corrida entre o reset de tabelas e a sequência de revisão.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
