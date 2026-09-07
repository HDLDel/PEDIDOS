# Integração da API BotBot no projeto PEDIDOS VOD

Como o projeto PEDIDOS VOD integra a API BotBot.chat v2: arquitetura, fluxo de notificação, armazenamento das chaves, rotas do servidor e frontend.

---

## 🏗️ Arquitetura geral

```
[Express server.js :8901]
        │
        ├── BotBotService.js (BotBot.chat API v2)  ← PRIMÁRIO
        │       │ POST https://botbot.chat/api/v2/sendText
        │       └── (se falhar) ↓
        └── WhatsAppService.js (http://localhost:8902)  ← FALLBACK
                └── whatsapp-server.js (motor WhatsApp local, porta 8902)
```

- O **BotBotService** tenta primeiro.
- Se falhar (erro, offline, exceção), cai no **WhatsApp local**.
- As chaves ficam no **banco SQLite** (tabela `settings`), configuráveis pelo painel admin — **não** no `.env`.

---

## 🔁 Fluxo de notificação (aprovar/rejeitar pedido)

1. Admin aprova ou rejeita um pedido → `POST /api/requests/:id/status` em `server.js`.
2. O servidor monta o objeto `reqData` com `{ reseller, whatsapp, title, status, rejectionReason }` (vem do `RequestModel.getById`, que dá `JOIN` na tabela `resellers`).
3. Chama `trySendNotification(reqData)`:
   - `bbSuccess = await BotBotService.sendStatusNotification(reqData)`
   - Se `!bbSuccess` → `WhatsAppService.sendStatusNotification(reqData)` (backup).
4. O `sendStatusNotification` do BotBot:
   - Normaliza o telefone para formato brasileiro com DDI 55.
   - Monta a mensagem de aprovação ou rejeição.
   - Lê as chaves do banco.
   - Divide a mensagem em blocos por `\n\n` e envia cada bloco com **1,5s** de intervalo.
   - Retorna `true` se todos os blocos forem enviados, `false` caso contrário.

5. **Sincronização extra:** se o pedido tem `tmdb_id` e `syncAll` for `true` (padrão), o servidor busca outros pedidos **pendentes** do mesmo conteúdo de outros revendedores, aprova/rejeita todos e notifica cada um.

---

## 🗄️ Onde as chaves são armazenadas

**Tabela `settings`** no SQLite (schema em `db.js`):

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**Chaves usadas:**

| key | valor |
|-----|-------|
| `BOTBOT_APP_KEY` | Identificador do Bot |
| `BOTBOT_AUTH_KEY` | Token de autorização |

**Leitura** (`BotBotService.getCredentials()`):

```sql
SELECT value FROM settings WHERE key = 'BOTBOT_APP_KEY'
SELECT value FROM settings WHERE key = 'BOTBOT_AUTH_KEY'
```

**Gravação** (`BotBotService.saveCredentials()`): UPSERT

```sql
INSERT INTO settings (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
```

> O painel admin grava as chaves via `POST /api/botbot/config`.

---

## 🧭 Rotas do servidor (Express)

| Método | Rota | Autenticação | Função |
|--------|------|:-------------:|--------|
| GET | `/admin/botbot` | admin | Renderiza a página de configuração (`views/admin/botbot.ejs`) com as chaves atuais |
| GET | `/api/botbot/status` | admin | Retorna `{ status: 'ready'\|'disconnected', qr, error? }` |
| GET | `/api/botbot/config` | admin | Retorna `{ appKey, authKey }` (carregar no painel) |
| POST | `/api/botbot/config` | admin | Salva `{ appKey, authKey }` |
| POST | `/api/botbot/test` | admin | Envia `teste botbot` para `{ phone }` e retorna o resultado |
| POST | `/api/notifications/resend-all` | admin | Reenvia notificações dos últimos 50 pedidos processados |

---

## 🔌 Frontend

### Página dedicada — `views/admin/botbot.ejs` + `public/js/admin-botbot.js`

Campos:
- **App Key** (identificador do bot)
- **Auth Key** (token de autorização)
- Botão **Salvar Credenciais** → `POST /api/botbot/config`
- Botão **Reenviar Todas as Notificações** → `POST /api/notifications/resend-all`
- Campo **Telefone de teste** + botão **Testar** → `POST /api/botbot/test`
- **Badge de status** (CONFIGURADO / AGUARDANDO CHAVES / CONECTADO / DESCONECTADO) → `GET /api/botbot/status`

### Painel principal — `public/js/dashboard.js`

Funções expostas globalmente (`window.*`):
- `loadBotBotConfig()` → `GET /api/botbot/config` e preenche os campos
- `saveBbConfig()` → `POST /api/botbot/config`
- `resendAllBbNotifications()` → `POST /api/notifications/resend-all`
- `testBbConnection()` → `POST /api/botbot/test`

A seção de configuração no modal do dashboard usa ids: `bbConfigAppKey`, `bbConfigAuthKey`, `bbConfigSaveBtn`, `bbConfigResendAllBtn`, `bbConfigTestPhone`, `bbConfigTestBtn`, `bbConfigTestResult`.

---

## 🧰 Dependências

- **Node.js ≥ 18** (uso de `fetch` nativo — não usa `axios`/`request`).
- **better-sqlite3** para o banco.
- Módulo ESM (`"type": "module"` no `package.json` — usa `import/export`).

---

## ⚙️ Como implementar em outro projeto (passo a passo)

1. Copie `src/BotBotService.js` e ajuste o `import db` para o seu banco (ou adapte `getCredentials`/`saveCredentials`).
2. Crie a tabela `settings` (ver `src/schema-settings.sql`) ou use suas próprias variáveis de configuração.
3. Adicione as rotas de configuração e status (ver `src/rotas-server.js`).
4. No momento de notificar (aprovar/rejeitar), chame `BotBotService.sendStatusNotification({ reseller, whatsapp, title, status, rejectionReason })`.
5. Se quiser o fallback, copie `src/whatsapp-service.js` (exige `whatsapp-server.js` na porta 8902).

Ou use o exemplo mínimo autossuficiente: [`src/exemplo-standalone.js`](src/exemplo-standalone.js).