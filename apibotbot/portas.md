# Portas usadas no sistema PEDIDOS VOD

Mapa completo das portas e serviços do sistema, incluindo as envolvidas no fluxo do BotBot.

---

## 📊 Tabela de portas

| Porta | Protocolo | Serviço | Bind | Responsável |
|-------|-----------|---------|------|-------------|
| **8901** | HTTP | Painel web + API (Express `server.js`) | `0.0.0.0` | Porta principal do sistema |
| **8902** | HTTP | Motor WhatsApp local (`whatsapp-server.js`) | `127.0.0.1` | Fallback de notificação + QR code; interno |
| **8900** | HTTP | nginx (reverse proxy para o painel) | `0.0.0.0` | Proxy público → `127.0.0.1:8901` |
| **80 / 443** | HTTP/HTTPS | Cloudflare → nginx | externo | Entrada pública do domínio |
| **443** (HTTPS outbound) | — | BotBot.chat API (`https://botbot.chat/api/v2`) | externo | Chamada sainte para a API BotBot |

---

## 🧭 Fluxo de tráfego

```
Usuário / Revendedor
   │ https://gestorpedidos.click (80/443 — Cloudflare)
   ▼
nginx :8900  ──proxy_pass──▶  Express :8901 (painel + API)
                                  │
                                  ├── BotBotService ──outbound HTTPS 443──▶ botbot.chat
                                  │
                                  └── WhatsAppService ──http://127.0.0.1:8902──▶ whatsapp-server :8902
```

---

## 📌 Detalhes

### 8901 — Painel + API (Express)

- `server.js` escuta em `0.0.0.0:8901`.
- Todas as rotas `/api/*`, `/admin/*`, `/revenda/*`.
- O **BotBotService** roda dentro deste processo.

```js
const PORT = 8901;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Painel rodando em http://127.0.0.1:${PORT}`);
});
```

### 8902 — Motor WhatsApp (fallback)

- `whatsapp-server.js` escuta em `127.0.0.1:8902` (só local).
- `WhatsAppService.WA_API = 'http://localhost:8902'`.
- Endpoint `/send` usado como fallback quando o BotBot falha.
- Autenticação interna por header `x-api-token` (token do `.env`).

### 8900 — nginx (proxy público)

- `server_name gestorpedidos.click`.
- Faz `proxy_pass` para `http://127.0.0.1:8901`.
- Rotas de login protegidas por rate limit (`limit_req_zone` 10r/m, `burst`).
- Gerido por `script/control.sh` (start / stop / reload / status).

### 80/443 — Cloudflare

- Record DNS `A` aponta o domínio para o IP do servidor.
- Origin Port: **8900**.
- Cloudflare recebe em 80/443 e encaminha para o nginx na 8900.

### Outbound — BotBot.chat

- A chamada do BotBot **sai** do servidor pela porta HTTPS **443**.
- Nenhuma porta precisa ser aberta no firewall para receber dados do BotBot (é chamada sainte).

---

## 🔓 O que precisa estar aberto no firewall

| Porta | Motivo |
|-------|--------|
| 80 | HTTP Cloudflare → nginx |
| 443 | HTTPS Cloudflare → nginx |
| 8900 | Fallback direto p/ acesso sem Cloudflare (opcional) |
| ~~8901~~ | **Não** expor — só local (nginx acessa via 127.0.0.1) |
| ~~8902~~ | **Não** expor — interno (`127.0.0.1`) |

---

## 💬 Nota sobre o BotBot

O BotBot.chat não exige abrir porta alguma: o PEDIDOS apenas **dispara POSTs** para `https://botbot.chat/api/v2/sendText`. A conexão é sempre iniciada pelo servidor.