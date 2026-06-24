# PEDIDOS — Gestor de Pedidos VOD

**Descrição:** Painel administrativo para gerenciar solicitações de conteúdo (filmes/séries) e reportes de erro para um portal VOD. Revendedores cadastram pedidos com busca TMDB; admin aprova/rejeita com notificação WhatsApp.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js, Express |
| Banco | SQLite (`better-sqlite3`, `data/vod.sqlite`) |
| Frontend | EJS, CSS3 (Grid/Flexbox), JS vanilla |
| Auth | express-session + bcrypt |
| Notificação | BotBot.chat API (primário) + whatsapp-web.js (fallback) |
| API externa | TMDB API (proxy backend) |
| Produção | PM2 |

---

## Estrutura do Projeto

```
PEDIDOS/
  ├── server.js              → Express app (rotas, auth, APIs, tudo)
  ├── db.js                  → Conexão SQLite + schema + migrações
  ├── WhatsAppService.js     → Motor WhatsApp local (whatsapp-web.js)
  ├── BotBotService.js       → Notificação via BotBot.chat API
  ├── package.json           → Dependências (type: module)
  ├── .env                   → Config (SESSION_SECRET, TMDB_API_KEY, etc)
  ├── seed.js                → Dados de teste iniciais
  ├── hash-password.js       → Utilitário de hash
  ├── add_admin.js           → Script para criar admin
  ├── whatsapp-server.js     → Servidor WhatsApp standalone
  ├── whatsapp-worker.js     → Worker WhatsApp
  ├── test_render.js         → Teste de renderização
  ├── setup-ubuntu.sh        → Instalação dependências Ubuntu
  ├── secure-vps.sh          → Segurança VPS
  │
  ├── models/
  │   ├── RequestModel.js    → CRUD pedidos + stats + busca
  │   ├── ResellerModel.js   → CRUD revendedores + auth
  │   ├── AdminModel.js      → CRUD admins + auth
  │   ├── TmdbModel.js       → Cache TMDB (posters, anos, notas)
  │   └── M3uModel.js        → Sincronismo M3U + matching conteúdo
  │
  ├── views/
  │   ├── dashboard.ejs      → Dashboard admin (cards agrupados)
  │   │
  │   ├── admin/
  │   │   ├── login.ejs      → Login admin
  │   │   ├── whatsapp.ejs   → Página conexão WhatsApp
  │   │   ├── botbot.ejs     → Config BotBot
  │   │   └── resellers.ejs  → Gestão revendedores
  │   │
  │   └── revenda/
  │       ├── login.ejs      → Login revendedor
  │       ├── register.ejs   → Cadastro revendedor
  │       ├── dashboard.ejs  → Dashboard revendedor
  │       ├── solicitar.ejs  → Formulário de pedido
  │       └── buscar-filme.ejs → Busca TMDB
  │
  ├── public/
  │   └── css/
  │       ├── style.css      → Tema dark premium
  │       └── reseller.css   → Tema revendedor
  │
  ├── data/
  │   └── vod.sqlite         → Banco SQLite (criado automaticamente)
  │
  ├── nginx/
  │   ├── nginx.conf
  │   ├── sites-available/   → Config vhost (gestorpedidos.click)
  │   ├── sites-enabled/
  │   └── snippets/          → fastcgi, snakeoil
  │
  ├── doc/
  │   └── DOCUMENTACAO.md    → Este arquivo
  │
  ├── skills/                → Skills para IA (opencode, universal, etc)
  │
  ├── inicio.md              → Mapa do projeto
  ├── readme.md              → README principal
  ├── M3U.md                 → Doc playlist M3U
  ├── BOTBOT_SETUP.md        → Doc integração BotBot
  ├── proxxyreverso.txt      → Guia proxy reverso Nginx
  └── session-ses_108b.md    → Log de sessão anterior
```

---

## Funcionalidades Principais

- **Painel Admin** — cards com pedidos agrupados por TMDB ID, filtros por status/categoria
- **Painel Revendedor** — cadastro, login, solicitar filme/série/erro com busca TMDB
- **Auto-agrupamento** — pedidos do mesmo TMDB ID viram 1 card (evita duplicatas visuais)
- **Verificação M3U** — checa se o conteúdo já existe na playlist (por poster hash + título + ano)
- **Notificação 2-canais** — BotBot.chat (primário) + whatsapp-web.js (fallback)
- **Reenvio em lote** — reenviar notificações dos últimos 50 pedidos
- **Contestação** — revendedor pode responder rejeição (max 2x) e voltar pra pendente
- **Sincronismo M3U** — importar playlist M3U para matching de catálogo
- **Proxy TMDB** — `/api/tmdb/search` protege API key do frontend
- **Auto-migração senhas** — senhas legadas convertidas para bcrypt na inicialização
- **Segurança** — sessão httpOnly, rate-limit de pedidos (max 10 pendentes), validação de propriedade

---

## API Endpoints

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/requests` | GET | Listar pedidos (filtros: status, category, search) |
| `/api/requests/:id` | GET | Detalhe do pedido |
| `/api/requests/:id/status` | POST | Aprovar/rejeitar (+ sync) |
| `/api/requests` | POST | Criar pedido |
| `/api/requests/:id` | DELETE | Deletar pedido (admin) |
| `/api/requests/:id/respond` | POST | Contestar rejeição (revenda) |
| `/api/requests/revenda/:id` | DELETE | Deletar próprio pedido (revenda) |
| `/api/resellers` | GET | Listar revendedores |
| `/api/resellers/:id` | GET/PUT/DELETE | CRUD revendedor |
| `/api/tmdb/search` | GET | Busca TMDB (proxy, auth revenda) |
| `/api/tmdb/:requestId` | GET | Dados TMDB de um pedido |
| `/api/whatsapp/status` | GET | Status conexão WhatsApp |
| `/api/whatsapp/start` | POST | Iniciar WhatsApp |
| `/api/whatsapp/reset` | POST | Resetar WhatsApp |
| `/api/botbot/status` | GET | Status BotBot |
| `/api/botbot/config` | POST | Configurar BotBot |
| `/api/m3u/status` | GET | Status sync M3U |
| `/api/m3u/sync` | POST | Iniciar sync M3U |
| `/api/m3u/clear` | POST | Limpar dados M3U |
| `/api/stats` | GET | Estatísticas |
| `/api/notifications/resend-all` | POST | Reenviar notificações em lote |

---

## Autenticação

- Admin: definido via `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)
- Revendedores: cadastro via `/revenda/register` ou `seed.js`
- Sessão: express-session com cookie httpOnly, secure, sameSite none

---

## Regras e Skills (IA)

### Skills carregadas automaticamente

| Skill | Descrição |
|-------|-----------|
| **regras** | Leitura obrigatória do `inicio.md`, auto-contexto, bloqueio de escrita, modo terminal |
| **listagem** | Índice rápido via `listagem.md` (usar `rg` antes de `find`/`glob`) |
| **auto-discover** | Carrega skills de `skills/<ferramenta>/` no projeto |

### Skills disponíveis no projeto (`skills/`)

```
skills/
  ├── antigravity/   → auto-discover, caveman, linux-cli, listagem, regras
  ├── codex/         → auto-discover, caveman, linux-cli, listagem, regras
  ├── gemini/        → auto-discover, caveman, linux-cli, listagem, regras
  ├── opencode/      → auto-discover, caveman, linux-cli, listagem, regras
  ├── qwen/          → auto-discover, caveman, linux-cli, listagem, regras
  └── universal/     → auto-discover, caveman, linux-cli, listagem, regras
```

---

## Comandos Úteis

```bash
# Dev
npm run dev

# Produção PM2
pm2 start server.js --name "dashboard"
pm2 start whatsapp-server.js --name "whatsapp-motor"
pm2 save
pm2 startup

# Acesso
http://localhost:8080/admin/login    — Admin
http://localhost:8080/revenda/login  — Revenda

# Nginx Proxy Reverso
cp nginx/sites-available/gestorpedidos.click /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/gestorpedidos.click /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

---

## Documentos de Referência

| Arquivo | Conteúdo |
|---------|----------|
| `inicio.md` | Mapa do projeto (stack, estrutura, API, comandos) |
| `readme.md` | Instalação Windows/Linux, stack, tecnologias |
| `M3U.md` | Guia de parsing, normalização e cruzamento de M3U |
| `BOTBOT_SETUP.md` | API v2 BotBot.chat (endpoints, payloads, credenciais) |
| `proxxyreverso.txt` | Configuração Nginx proxy reverso + Cloudflare Worker |
| `package.json` | Dependências: express, better-sqlite3, bcryptjs, ejs, whatsapp-web.js |

---

## Convenções

- Backend: JS ES modules (`import/export`), nomes em inglês
- Frontend: EJS + CSS vanilla, JS vanilla
- DB: SQLite com WAL mode, migrações seguras (`safeAddColumn`)
- Notificação: BotBot primário, WhatsApp local fallback
- Pedidos: status `pending` → `approved` / `rejected`
