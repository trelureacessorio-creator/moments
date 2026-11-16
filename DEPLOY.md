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

## Deploy grátis: Neon + Render (recomendado, sem cartão)

Banco no **Neon** (Postgres grátis) e API + Web no **Render** (plano free). O
`render.yaml` na raiz já descreve os dois serviços.

1. **Banco (Neon)**
   - Crie uma conta em neon.tech → novo projeto Postgres.
   - Copie a **connection string** (algo como
     `postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require`).

2. **Render (API + Web)**
   - Em render.com → **New → Blueprint** → conecte o repositório
     `trelureacessorio-creator/moments`. O Render lê o `render.yaml`.
   - Em **moments-api**, defina as variáveis marcadas `sync: false`:
     - `DATABASE_URL` = a string do Neon (mantenha `?sslmode=require`),
     - `CORS_ORIGIN` = a URL do **moments-web** (preencha depois do 1º deploy).
     - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` são geradas automaticamente.
   - Em **moments-web**, defina `VITE_API_URL` = a URL da **moments-api**.
   - Faça o deploy. Depois que as duas URLs existirem, volte e ajuste `CORS_ORIGIN`
     (na API) e `VITE_API_URL` (no web) com as URLs reais e **refaça o deploy** de
     cada uma.

> Limite do plano free do Render: a API **suspende após ~15 min** de inatividade
> (a 1ª chamada seguinte tem *cold start*). O Moments contorna isso gerando os avisos
> também no `/sync/pull` — quando a pessoa abre o app, a API acorda e cria os avisos.
> Para a API ficar **sempre ligada**, use o Fly.io (abaixo) ou um ping periódico
> (ex.: um cron externo chamando `/health` a cada 10 min).

## Alternativa sempre ligada: Neon + Fly.io (API) + Cloudflare Pages (web)

- **API (Fly.io)**: `fly launch` na raiz (usa o `Dockerfile`), defina os secrets
  (`fly secrets set JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... DATABASE_URL=... CORS_ORIGIN=...`).
  O plano free mantém uma VM pequena ligada (exige cartão para verificação, sem cobrança
  dentro do free).
- **Web (Cloudflare Pages / Vercel)**: conecte o repositório, defina o diretório do
  app como `web`, build `npm run build`, saída `web/dist`, variável `VITE_API_URL`.

## Deploy em plataforma gerenciada (geral)

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

## IA com Claude (opcional, já integrada)

O assistente funciona sem nenhuma chave (motor determinístico, grátis). Para respostas
de conversa mais naturais e uma análise de diário melhor, defina na **moments-api**:

- `ANTHROPIC_API_KEY` = sua chave da Anthropic (console.anthropic.com).
- `ANTHROPIC_MODEL` (opcional) = `claude-haiku-5-5` para custo baixo (padrão: `claude-opus-5-5`).
- `ANTHROPIC_EFFORT` (opcional) = `low` | `medium` | `high` (padrão: `low`).

Garantias: o Claude só vê um **resumo dos dados do próprio usuário** (fundamentado) e
**nunca cria nem altera** registros — toda escrita continua sendo uma sugestão que o
usuário confirma no app. Se a chave faltar ou a API falhar, cai no motor determinístico.
Tem custo por uso (cobrado pela Anthropic); comece com `claude-haiku-5-5` para gastar pouco.

## Pendente para versões seguintes

- **Arquivos (upload real)**: armazenamento de objetos (S3/R2) com URLs assinadas.
- **Voz**: captura de áudio + transcrição (serviço externo com chave).
