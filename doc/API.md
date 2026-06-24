# API — PEDIDOS VOD

## Base URL

```
http://localhost:8080
https://gestorpedidos.click (produção)
```

---

## Autenticação

Sessão via `express-session` com cookie httpOnly + secure.

### Admin

```
POST /admin/login
Body: { username, password }
Success: redirect /dashboard
```

### Revendedor

```
POST /revenda/login
Body: { username, password }
Success: redirect /revenda/dashboard

POST /revenda/register
Body: { name, username, password, phone, store }
```

---

## Pedidos (Requests)

### Listar pedidos

```
GET /api/requests?status=pending&category=movie&search=termo
```

| Query | Tipo | Descrição |
|-------|------|-----------|
| status | string | pending, approved, rejected |
| category | string | movie, series, error |
| search | string | Busca por título |
| limit | number | Limite de resultados |
| offset | number | Paginação |

### Detalhe do pedido

```
GET /api/requests/:id
```

### Criar pedido

```
POST /api/requests
Body: {
  "title": "Nome do Filme",
  "type": "movie" | "series" | "error",
  "category": "ação" | "comédia" | etc,
  "tmdb_id": 123456,
  "tmdb_title": "Título TMDB",
  "tmdb_original_title": "Original Title",
  "year": 2024,
  "poster_path": "/path/to/poster.jpg",
  "reseller_id": 1,
  "episodes": "1ª Temporada" (opcional),
  "reason": "Erro no player" (se type=error)
}
```

### Aprovar/Rejeitar

```
POST /api/requests/:id/status
Body: { "status": "approved" | "rejected", "reason": "Motivo" (se rejected) }
```

### Deletar pedido (admin)

```
DELETE /api/requests/:id
```

### Contestar rejeição (revenda)

```
POST /api/requests/:id/respond
Body: { "message": "Justificativa" }
```
Max 2 contestações por pedido.

### Deletar próprio pedido (revenda)

```
DELETE /api/requests/revenda/:id
```

---

## Revendedores

### Listar

```
GET /api/resellers
```

### CRUD

```
GET    /api/resellers/:id
PUT    /api/resellers/:id  Body: { name, username, phone, store, active }
DELETE /api/resellers/:id
```

---

## TMDB

### Busca (proxy)

```
GET /api/tmdb/search?q=nome+do+filme&type=movie
```

| Query | Descrição |
|-------|-----------|
| q | Termo de busca |
| type | movie ou series |

Protege a API key do frontend.

### Dados TMDB do pedido

```
GET /api/tmdb/:requestId
```

---

## WhatsApp

### Status

```
GET /api/whatsapp/status
```

Retorna: `{ connected: bool, qrCode: string|null }`

### Iniciar

```
POST /api/whatsapp/start
```

### Resetar

```
POST /api/whatsapp/reset
```

---

## BotBot

### Status

```
GET /api/botbot/status
```

### Configurar

```
POST /api/botbot/config
Body: { appKey, authKey, phone, enabled }
```

---

## M3U

### Status sync

```
GET /api/m3u/status
```

### Iniciar sync

```
POST /api/m3u/sync
```

### Limpar dados

```
POST /api/m3u/clear
```

---

## Stats

### Gerais

```
GET /api/stats
```

Retorna totais de pedidos, revendedores, taxas de aprovação.

---

## Notificações

### Reenvio em lote

```
POST /api/notifications/resend-all
```

Reenvia notificações dos últimos 50 pedidos pendentes.
