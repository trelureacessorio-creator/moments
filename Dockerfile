# API Moments — build de produção (multi-stage)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# node_modules completo (inclui o CLI do Prisma para `migrate deploy` no start)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3000
# Aplica migrações e sobe a API. Com múltiplas réplicas, rode as migrações
# como passo separado do release (ver DEPLOY.md) em vez de no start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
