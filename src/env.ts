import "dotenv/config";

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  ACCESS_TTL_MIN: Number(process.env.ACCESS_TTL_MIN ?? 15),
  REFRESH_TTL_DAYS: Number(process.env.REFRESH_TTL_DAYS ?? 60),
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};

if (env.NODE_ENV === "production") {
  for (const k of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if (!process.env[k] || (process.env[k] ?? "").includes("change-me")) {
      throw new Error(`Env ${k} precisa de um valor seguro em produção.`);
    }
  }
}
