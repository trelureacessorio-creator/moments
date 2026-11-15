# Moments — API (Fase 1)

Alicerce do backend do Moments: **contas, autenticação, modelo de dados e sincronização**.
Stack: **Node + TypeScript + Fastify + PostgreSQL + Prisma**.

Esta é a Fase 1 do roadmap (ver o documento de arquitetura). Ela entrega a base sobre a
qual as fases seguintes (IA, notificações, telas) são construídas.

## O que já funciona

- **Contas e autenticação**: cadastro, login, token de acesso (JWT curto) + refresh com
  rotação, sessões por dispositivo, logout e revogação remota (celular perdido).
- **Modelo de dados**: as 21 entidades da especificação (`prisma/schema.prisma`), com
  propriedade (`ownerId`) e campos de sincronização.
- **Sincronização incremental**: `pull`/`push` com versão monotônica por registro (`rev`),
  exclusão lógica (tombstones), resolução de conflito (última escrita vence, conflito
  sinalizado) e leitura ciente de compartilhamento.
- **Compartilhamento e auditoria**: compartilhar um item por **e-mail** da conta, permissão
  **ver**/**editar** por item, histórico de alterações (quem, o quê, antes, depois) e
  revogação.
- **Notificações programadas**: um agendador gera os avisos (resumo da manhã, conferência
  noturna, planejamento de domingo e alerta de meta a 10 dias do prazo) respeitando o fuso
  e os horários de cada usuário, sem duplicar; alterações em itens compartilhados avisam o
  dono. Os avisos sincronizam como registros `Notification` e podem ser marcados como lidos.
- **Privacidade por padrão**: toda consulta filtra por proprietário ou compartilhamento
  ativo; ninguém lê o que não é seu.

## Pré-requisitos

- Node 20+ e Docker (para o PostgreSQL).

## Subir o ambiente

```bash
cp .env.example .env            # ajuste os segredos
npm install
docker compose up -d db         # PostgreSQL em localhost:5433
npm run migrate:deploy          # aplica as migrações versionadas
npm run seed                    # (opcional) dados de exemplo
npm run dev                     # API em http://localhost:3000
```

### Migrações

O schema é versionado em `prisma/migrations/` (migrações reproduzíveis, próprias para
produção). Comandos:

```bash
npm run migrate:deploy   # aplica as migrações pendentes (CI e produção)
npm run migrate          # cria uma nova migração a partir de mudanças no schema (dev)
npm run migrate:status   # mostra o estado das migrações
```

> Em produção, defina `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` com valores longos e
> aleatórios. Use `migrate:deploy` (não `db:push`) para aplicar o schema.

### Integração contínua

`.github/workflows/ci.yml` roda a cada push/PR na `main`: aplica as migrações e executa
os testes do backend (com um PostgreSQL de serviço) e faz typecheck + build do app web.

## Testes

```bash
docker compose up -d db
npm run migrate:deploy
npm test
```

Cobrem: fluxo de autenticação e sessões, sincronização (criar/baixar/atualizar/excluir e
conflito), privacidade (um usuário não vê nem edita dados de outro) e compartilhamento
(ver vs editar, histórico de alterações, revogação).

## Rotas principais

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/auth/register` | Cria conta, devolve `accessToken` + `refreshToken` |
| POST | `/auth/login` | Autentica e abre sessão |
| POST | `/auth/refresh` | Rotaciona o refresh e devolve novo par de tokens |
| POST | `/auth/logout` | Encerra a sessão do refresh enviado |
| GET | `/auth/me` | Dados da conta (autenticado) |
| GET | `/auth/sessions` | Lista dispositivos/sessões ativas |
| DELETE | `/auth/sessions/:id` | Revoga uma sessão (dispositivo perdido) |
| GET | `/sync/collections` | Lista as coleções sincronizáveis |
| POST | `/sync/pull` | Baixa mudanças desde um `cursor` (próprias + compartilhadas) |
| POST | `/sync/push` | Envia mudanças (upsert/exclusão) com `baseRev` |
| POST | `/shares` | Compartilha um item por e-mail (`ver`/`editar`) |
| GET | `/shares` | Compartilhamentos criados e recebidos |
| DELETE | `/shares/:id` | Encerra um compartilhamento |
| GET | `/shares/activity` | Histórico de alterações nos meus itens compartilhados |

### Protocolo de sincronização (resumo)

`POST /sync/push`
```json
{ "changes": { "tasks": [ { "id": "<uuid>", "text": "Comprar fraldas", "done": false, "baseRev": 12 } ] } }
```
Resposta: `{ applied: [{collection,id,rev}], conflicts: [...], rejected: [...], cursor }`.
Exclusão: inclua `"deleted": true`. Criação: envie um `id` (uuid) que ainda não existe.

`POST /sync/pull`
```json
{ "cursor": 0 }
```
Resposta: `{ changes: { <coleção>: [registros...] }, cursor }` — inclui tombstones
(`deletedAt`) e itens compartilhados com você.

## Notificações programadas

Um agendador roda a cada minuto (ver `src/index.ts`) e chama
`generateDueNotifications(now)` (`src/notifications/generator.ts`), que cria os avisos
vencidos de cada usuário conforme suas preferências (horários e fuso), de forma idempotente
(campo `dedupeKey`). Fora de produção há uma rota de apoio para disparar a geração num
instante dado, útil em testes:

```
POST /dev/run-notifications   { "at": "2026-11-15T23:00:00Z" }   -> { "created": N }
```

Marcar como lida é uma escrita normal de sincronização sobre a coleção `notifications`
(`status: "read"`), então funciona offline e sincroniza como qualquer outra mudança.

## Limitações conhecidas desta fase

- Resolução de conflito é por registro (última escrita vence), com o conflito sinalizado ao
  cliente; a fusão por campo pode vir depois.
- Upload real de arquivos (S3) e o processamento de IA entram nas fases seguintes; aqui os
  arquivos guardam apenas metadados (`storageKey`).
- Ao revogar um compartilhamento, o item some das próximas sincronizações do destinatário;
  um tombstone explícito de revogação pode ser adicionado para limpeza imediata do cache
  local.
