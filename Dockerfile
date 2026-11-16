# API Moments — build de produção (multi-stage)
# Base Debian slim (não Alpine): o Prisma precisa de glibc/OpenSSL e funciona sem ajustes.
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# node_modules completo (inclui o CLI do Prisma para `migrate deploy` no start)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3000
# Aplica migrações e sobe a API. Com múltiplas réplicas, rode as migrações
# como passo separado do release (ver DEPLOY.md) em vez de no start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
