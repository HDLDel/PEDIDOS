# BotBot.chat API v2 — Especificação

Especificação da API **BotBot.chat v2** conforme usada no projeto PEDIDOS VOD. Todas as chamadas deste projeto usam **apenas** o endpoint `sendText`.

---

## 🌐 Base URL

```
https://botbot.chat/api/v2
```

Todos os endpoints ficam sob essa base.

---

## 🔐 Autenticação (headers obrigatórios)

Toda requisição precisa de 2 headers customizados:

| Header | Obrigatório | Descrição |
|--------|:-----------:|-----------|
| `Content-Type` | sim | `application/json` |
| `appKey` | sim | Identificador do Bot / dispositivo WhatsApp |
| `authKey` | sim | Token de autorização da conta |

> ⚠️ **Importante:** autenticação é por **headers `${appKey}` e `${authKey}`**, não por `Authorization: Bearer`. Requisições diretas do navegador (browser) são bloqueadas por CORS — **sempre faça a chamada pelo backend** (Node.js / curl).

---

## ✉️ POST /sendText — Enviar mensagem de texto

### Request

```
POST https://botbot.chat/api/v2/sendText
```

### Headers

```
Content-Type: application/json
appKey: <APP_KEY>
authKey: <AUTH_KEY>
```

### Body (JSON)

```json
{
  "to": "<TELEFONE_TESTE>",
  "message": "Texto da mensagem",
  "typingDelay": 1
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `to` | string | sim | WhatsApp do destinatário com código do país: `55` (Brasil) + DDD + número |
| `message` | string | sim | Texto da mensagem (máx. **3500** caracteres) |
| `typingDelay` | integer | não | Segundos simulando "digitando" (mín. `1`, padrão `1`) |
| `queue` | boolean | não | Fila para processamento assíncrono (padrão `false`) |
| `delay` | integer | não | Segundos de atraso ao enfileirar (padrão `0`) |
| `contact` | object | não | Metadados opcionais p/ criar/atualizar contato (`name`, `email`, `note`, `expiresAt`, `telegram`, `amount`, `currency`, `plan`, `username`, `password`, `url`) |

### Resposta 200 (sucesso)

```json
{
  "messageStatus": "Success",
  "data": {
    "from": "SENDER_NUMBER",
    "to": "RECEIVER_NUMBER",
    "statusCode": 200,
    "queued": true
  }
}
```

---

## ❌ Códigos de erro

| Código | Significado |
|--------|-------------|
| `200` | Sucesso (`messageStatus: "Success"`) |
| `400` | Bad request (payload inválido) |
| `401` | Unauthorized — AppKey inválido ou dispositivo (WhatsApp) offline |
| `404` | Retorno não encontrado (usado em outras rotas, ex. `sendReply`) |
| `422` | Erro de validação |
| `500` | Erro upstream do WhatsApp/API |

Estrutura de erro padrão:

```json
{
  "error": "string",
  "message": "string"
}
```

### Erro específico de bot offline

Quando o bot está com o WhatsApp desconectado, a API retorna em `error` um texto contendo **`não está mais conectado`** (usado pelo `getStatus()` para marcar o status como `disconnected`):

```json
{
  "error": "O bot não está mais conectado..."
}
```

---

## 🧪 Comandos de teste (curl)

### Teste via curl

```bash
curl -X POST https://botbot.chat/api/v2/sendText \
  -H "Content-Type: application/json" \
  -H "appKey: SUA_APP_KEY" \
  -H "authKey: SEU_AUTH_KEY" \
  -d '{"to": "<TELEFONE_TESTE>", "message": "Teste", "typingDelay": 1}'
```

### Teste verboso (ver headers/status HTTP)

```bash
curl -v -X POST https://botbot.chat/api/v2/sendText \
  -H "Content-Type: application/json" \
  -H "appKey: SUA_APP_KEY" \
  -H "authKey: SEU_AUTH_KEY" \
  -d '{"to": "<TELEFONE_TESTE>", "message": "Teste funcional BotBot API v2", "typingDelay": 1}'
```

---

## 📚 Outros endpoints existentes na API v2 (não usados no PEDIDOS)

Para implementações futuras, a API v2 também expõe:

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v2/sendContact` | Envia contato (vCard) |
| POST | `/api/v2/sendReply` | Envia resposta salva (`replyId`) |
| POST | `/api/v2/sendTemplate` | Envia template salvo (`templateId`) |
| GET | `/api/v2/templates` | Lista templates (paginado, com `search`) |
| POST | `/api/v2/templates` | Cria template |
| GET/PUT/DELETE | `/api/v2/templates/{template}` | CRUD de template |
| GET | `/api/v2/replies` | Lista respostas salvas (paginado) |
| GET | `/api/v2/replies/{reply}` | Detalhe de uma resposta |

> Especificação OpenAPI 3 disponível em: `https://botbot.chat/botbot-openapi.json`

---

## 🚦 Regras observadas na integração do PEDIDOS

1. **Sempre pelo backend** — nunca chamar do navegador (CORS bloqueia).
2. **Normalizar telefone** — extrair só dígitos (`\D` → vazio) e prefixar `55` quando não começar com `55` e tiver ≥ 10 dígitos.
3. **Intervalo entre mensagens** — ao dividir em blocos, aguardar **1,5s** entre envios.
4. **Tratar falha** — `response.ok` decide sucesso; caso contrário, disparar fallback.