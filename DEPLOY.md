# Moments — Lançamento (Fase 5)

Guia para colocar o Moments no ar. O projeto tem duas partes: a **API** (raiz) e o
**app web** (`web/`), mais um **PostgreSQL**.

## Visão geral

- **API**: Node + Fastify + Prisma. Imagem em `Dockerfile`. Aplica as migrações e sobe.
- **Web**: app Vite/React estático, servido por nginx (`web/Dockerfile`). A URL da API é
  embutida no build (`VITE_API_URL`).
- **Banco**: PostgreSQL 16 (use um serviço **gerenciado** em produção).

## Subir tudo com Docker (referência)

```bash
export JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
export JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
export DB_PASSWORD="$(openssl rand -hex 16)"
export CORS_ORIGIN="https://SEU-DOMINIO-WEB"
export VITE_API_URL="https://SUA-API"
docker compose -f docker-compose.prod.yml up -d --build
# Web em :8080, API em :3000
```

> `docker-compose.prod.yml` é uma referência para um host único. Em produção séria,
> prefira a API e o banco em serviços gerenciados e o web em uma CDN/host estático.

## Deploy em plataforma gerenciada (recomendado)

1. **Banco**: crie um PostgreSQL gerenciado e copie a `DATABASE_URL`.
2. **API**: faça deploy da imagem do `Dockerfile` (Fly.io, Railway, Render, ECS…). Defina:
   - `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (longos e aleatórios),
   - `CORS_ORIGIN` = a URL do app web,
   - `NODE_ENV=production`.
   As migrações rodam no start (`prisma migrate deploy`).
3. **Web**: build com `VITE_API_URL` = a URL pública da API e publique o `dist/`
   (host estático/CDN) ou a imagem do `web/Dockerfile`.

### Migrações com múltiplas réplicas

Com mais de uma instância da API, não rode a migração no start de cada uma. Rode uma vez
no release:

```bash
npm ci && npx prisma migrate deploy
```

e troque o `CMD` da API por apenas `node dist/index.js`.

## Checklist de segurança antes de abrir ao público

- [ ] `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` fortes e secretos (a API recusa iniciar em
      produção com os valores de exemplo).
- [ ] `CORS_ORIGIN` restrito à(s) origem(ns) do app web.
- [ ] HTTPS em tudo (a plataforma/ingресс encerra TLS); cookies/tokens só por HTTPS.
- [ ] Rotas de desenvolvimento desligadas — já são omitidas quando `NODE_ENV=production`.
- [ ] Backups automáticos do PostgreSQL e teste de restauração.
- [ ] Segredos fora do Git (apenas `.env.example` versionado).

## Mapa dos testes obrigatórios da especificação

| # | Teste | Onde é coberto |
| --- | --- | --- |
| 1 | Voz cria após confirmar | Pendente (voz requer serviço de transcrição) |
| 2 | Diário: áudio/transcrição/título/resumo | Título/resumo/sentimento: `tests/ai.test.ts`; áudio pendente |
| 3 | Calendário nos dias/horas certos | App web (Agenda) + sync (`tests/sync.test.ts`) |
| 4 | Notificações respeitam preferências/concluídas | `tests/notifications.test.ts` |
| 5 | Metas: valores/prazos/gráficos | App web (Metas) sobre `goals`/`goalHistory` |
| 6 | Hábitos acompanhados | App web (Hábitos) sobre `habitLogs` |
| 7 | Busca inteligente encontra o antigo | `tests/ai.test.ts` |
| 8 | Compartilhamento respeita autorizações | `tests/sharing.test.ts` |
| 9 | Alteração gera histórico e aviso | `tests/sharing.test.ts` + `tests/notifications.test.ts` |
| 10 | Arquivos guardam e recuperam | Pendente (upload real requer S3) |
| 11 | Financeiro calcula certo | App web (Meu Dinheiro); saldo só com dados suficientes |
| 12 | Sincronização entre dispositivos | `tests/sync.test.ts` + E2E (navegador limpo) |
| 13 | Privacidade: sem acesso indevido | `tests/privacy.test.ts` |
| 14 | IA não altera sem confirmar | `tests/ai.test.ts` (sugestão não cria nada) |
| 15 | Retrospectivas só com dados existentes | App web (Minha Evolução) calcula dos dados |

## Pendente para versões seguintes

- **Arquivos (upload real)**: armazenamento de objetos (S3/R2) com URLs assinadas.
- **Voz**: captura de áudio + transcrição (serviço externo com chave).
- **IA com Claude**: trocar o motor determinístico pelo provedor Claude quando houver
  `ANTHROPIC_API_KEY` (o ponto de troca está em `src/ai/engine.ts`).
