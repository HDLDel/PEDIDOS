# Arquitetura — PEDIDOS VOD

---

## Fluxo Geral

```
[Revendedor] ──> /revenda/solicitar ──> POST /api/requests
                              │
                              ▼
                    ┌─────────────────┐
                    │   SQLite DB     │
                    │  (vod.sqlite)   │
                    └───────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       [BotBot API]  [WhatsApp Local]  [Dashboard Admin]
                          (fallback)
```

---

## Camadas

### 1. Server (`server.js`)

Entry point do Express. Configura:
- Sessão (express-session)
- Views (EJS)
- Static files (public/)
- Rotas admin + revenda
- API REST
- Proteção contra crashes (unhandledRejection, uncaughtException)

### 2. Database (`db.js`)

SQLite via `better-sqlite3`:
- WAL mode
- Migrações seguras com `safeAddColumn()`
- Tabelas: `admins`, `resellers`, `requests`, `m3u_contents`

### 3. Models (`models/`)

| Model | Função |
|-------|--------|
| `AdminModel.js` | CRUD + autenticação admin |
| `ResellerModel.js` | CRUD + autenticação revendedor |
| `RequestModel.js` | CRUD pedidos, agrupamento, stats, busca |
| `TmdbModel.js` | Cache TMDB (evita chamadas repetidas) |
| `M3uModel.js` | Sincronismo M3U, matching por poster hash + título |

### 4. Views (`views/`)

EJS templates organizados por papel:

```
views/
  ├── dashboard.ejs         → Admin dashboard
  ├── admin/
  │   ├── login.ejs         → Login admin
  │   ├── whatsapp.ejs      → Status WhatsApp
  │   ├── botbot.ejs        → Config BotBot
  │   └── resellers.ejs     → CRUD revendedores
  └── revenda/
      ├── login.ejs         → Login revendedor
      ├── register.ejs      → Cadastro
      ├── dashboard.ejs     → Meus pedidos
      ├── solicitar.ejs     → Novo pedido
      └── buscar-filme.ejs  → Busca TMDB
```

### 5. Notificação

| Serviço | Arquivo | Prioridade |
|---------|---------|------------|
| BotBot.chat API | `BotBotService.js` | Primário |
| WhatsApp local | `WhatsAppService.js` | Fallback |
| WhatsApp server | `whatsapp-server.js` | Standalone |
| WhatsApp worker | `whatsapp-worker.js` | Processo auxiliar |

---

## Banco de Dados

### Schema (`db.js`)

```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  store TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reseller_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('movie','series','error')),
  category TEXT,
  tmdb_id INTEGER,
  tmdb_title TEXT,
  tmdb_original_title TEXT,
  year INTEGER,
  poster_path TEXT,
  episodes TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  admin_reason TEXT,
  contest_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified INTEGER DEFAULT 0,
  FOREIGN KEY (reseller_id) REFERENCES resellers(id)
);

CREATE TABLE m3u_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  logo_hash TEXT,
  year INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Migrações

`db.js` contém `safeAddColumn()` para adicionar colunas sem perder dados:

```javascript
function safeAddColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!existing.find(c => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}
```

---

## Fluxo de Pedido

```
1. Revendedor busca filme via TMDB (/api/tmdb/search)
2. Preenche formulário e envia (POST /api/requests)
3. Pedido salvo como "pending"
4. Admin vê card agrupado no dashboard
5. Admin aprova ou rejeita (POST /api/requests/:id/status)
   ├── approved → notificação de sucesso
   └── rejected → notificação com motivo + pode contestar (2x)
6. Se contestado, volta pra "pending"
7. Notificações enviadas via BotBot > WhatsApp fallback
```

---

## Segurança

- Sessão httpOnly + secure + sameSite none
- Rate-limit: max 10 pedidos pendentes por revendedor
- Validação de propriedade: revendedor só vê/edita próprios pedidos
- Proxy TMDB: API key nunca exposta ao frontend
- Senhas: bcrypt com hash na criação e migração automática de legadas
