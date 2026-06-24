# Notificações — PEDIDOS VOD

Sistema de notificação em 2 canais: BotBot.chat API (primário) + WhatsApp local (fallback).

---

## Arquitetura

```
[Pedido aprovado/rejeitado]
          │
          ▼
┌─────────────────────┐
│  BotBotService.js   │ ← Tenta primeiro
│  (API BotBot.chat)  │
└─────────┬───────────┘
          │
     Sucesso? ── Sim ──> Fim
          │
         Não
          ▼
┌─────────────────────┐
│ WhatsAppService.js  │ ← Fallback
│ (whatsapp-web.js)   │
└─────────┬───────────┘
          │
     Sucesso? ── Sim ──> Fim
          │
         Não
          ▼
    Log de erro
```

---

## BotBot.chat API (Primário)

### Credenciais

```
AppKey: <BOTBOT_APP_KEY>
AuthKey: <BOTBOT_AUTH_KEY>
```

### Endpoint

```
POST https://botbot.chat/api/v2/sendText
```

### Headers

```
Content-Type: application/json
appKey: <APP_KEY>
authKey: <AUTH_KEY>
```

### Payload

```json
{
  "to": "<TELEFONE_TESTE>",
  "message": "Texto da notificação",
  "typingDelay": 1
}
```

### Teste via curl

```bash
curl -X POST https://botbot.chat/api/v2/sendText \
  -H "Content-Type: application/json" \
  -H "appKey: <BOTBOT_APP_KEY>" \
  -H "authKey: <BOTBOT_AUTH_KEY>" \
  -d '{"to": "<TELEFONE_TESTE>", "message": "Teste", "typingDelay": 1}'
```

### Respostas

| Código | Significado |
|--------|-------------|
| 200 | Sucesso (`messageStatus: "Success"`) |
| 400 | Bad request |
| 401 | Unauthorized (AppKey inválido ou dispositivo offline) |
| 500 | Erro upstream WhatsApp |

---

## WhatsApp Local (Fallback)

### Serviços

| Arquivo | Função |
|---------|--------|
| `WhatsAppService.js` | Classe principal (whatsapp-web.js) |
| `whatsapp-server.js` | Servidor standalone na porta 8880 |
| `whatsapp-worker.js` | Worker para processamento em background |

### Fluxo

```bash
# Iniciar motor WhatsApp
pm2 start whatsapp-server.js --name "whatsapp-motor"

# Verificar status
curl http://localhost:8880/status
```

### API do WhatsApp Server

```
GET  /status       → Status da conexão + QR code
POST /start        → Iniciar sessão
POST /reset        → Resetar sessão
POST /send         → Enviar mensagem (Body: { to, message })
```

### QR Code

Após iniciar, o QR code aparece no painel admin (`/admin/whatsapp`). Escaneie com o WhatsApp para conectar.

---

## Reenvio em Lote

```
POST /api/notifications/resend-all
```

Reenvia notificações dos últimos 50 pedidos pendentes. Útil quando o serviço fica offline temporariamente.

---

## Configuração no .env

```env
# BotBot
BOTBOT_APP_KEY=<BOTBOT_APP_KEY>
BOTBOT_AUTH_KEY=<BOTBOT_AUTH_KEY>
BOTBOT_PHONE=<TELEFONE_TESTE>
BOTBOT_ENABLED=true

# WhatsApp Local
WHATSAPP_API_URL=<WHATSAPP_API_URL>
WHATSAPP_ENABLED=true
WHATSAPP_API_TOKEN=token_hex_64_caracteres
```
