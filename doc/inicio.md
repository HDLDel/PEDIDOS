# PEDIDOS — Gestor de Pedidos VOD

## O Que e

Painel administrativo para gerenciar solicitacoes de conteudo (filmes/series) e reportes de erro para um portal VOD. Revendedores cadastram pedidos com busca TMDB; admin aprova/rejeita com notificacao WhatsApp.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js, Express |
| Banco | SQLite (`better-sqlite3`, `data/vod.sqlite`) |
| Frontend | EJS, CSS3 (Grid/Flexbox), JS vanilla |
| Auth | express-session + bcrypt |
| Notificacao | whatsapp-web.js (local) + BotBot.chat API (fallback) |
| API externa | TMDB API (proxy backend) |
| Producao | PM2 |

## Estrutura

```
PEDIDOS/
  ├── server.js              → Express app (rotas, auth, APIs, tudo)
  ├── db.js                  → Conexao SQLite + schema + migracoes
  ├── WhatsAppService.js     → Motor WhatsApp local (whatsapp-web.js)
  ├── BotBotService.js       → Notificacao via BotBot.chat API
  ├── package.json           → Dependencias (type: module)
  ├── .env                   → Config (SESSION_SECRET, TMDB_API_KEY, etc)
  ├── seed.js                → Dados de teste iniciais
  ├── hash-password.js       → Utilitario de hash
  ├── add_admin.js           → Script criar admin
  ├── whatsapp-server.js     → Servidor WhatsApp standalone
  ├── whatsapp-worker.js     → Worker WhatsApp
  ├── test_render.js         → Teste renderizacao
  ├── setup-ubuntu.sh        → Instalacao dependencias Ubuntu
  ├── secure-vps.sh          → Seguranca VPS
  ├── salvar.bat             → Backup Windows
  ├── M3U.md                 → Doc playlist M3U
  ├── BOTBOT_SETUP.md        → Doc integracao BotBot
  │
  ├── models/
  │   ├── RequestModel.js    → CRUD pedidos + stats + busca
  │   ├── ResellerModel.js   → CRUD revendedores + auth
  │   ├── AdminModel.js      → CRUD admins + auth
  │   ├── TmdbModel.js       → Cache TMDB (posters, anos, notas)
  │   └── M3uModel.js        → Sincronismo M3U + matching conteudo
  │
  ├── views/
  │   ├── dashboard.ejs      → Dashboard admin (cards agrupados)
  │   ├── reseller.ejs       → Nao usado (legado)
  │   │
  │   ├── admin/
  │   │   ├── login.ejs      → Login admin
  │   │   ├── dashboard.ejs  → Nao usado (dashboard.ejs root)
  │   │   ├── whatsapp.ejs   → Pagina conexao WhatsApp
  │   │   ├── botbot.ejs     → Config BotBot
  │   │   └── resellers.ejs  → Gestao revendedores
  │   │
  │   └── revenda/
  │       ├── login.ejs      → Login revendedor
  │       ├── register.ejs   → Cadastro revendedor
  │       ├── dashboard.ejs  → Dashboard revendedor
  │       ├── solicitar.ejs  → Formulario de pedido
  │       └── buscar-filme.ejs → Busca TMDB
  │
  ├── public/css/
  │   ├── style.css          → Tema dark premium
  │   └── reseller.css       → Tema revendedor
  │
  ├── data/
  │   └── vod.sqlite         → Banco SQLite (criado automaticamente)
  │
  └── nginx/
      ├── nginx.conf
      ├── sites-available/   → Config vhost (gestorpedidos.click)
      ├── sites-enabled/
      └── snippets/          → fastcgi, snakeoil
```

## Funcionalidades Principais

- **Painel Admin** — cards com pedidos agrupados por TMDB ID, filtros por status/categoria
- **Painel Revendedor** — cadastro, login, solicitar filme/serie/erro com busca TMDB
- **Auto-agrupamento** — pedidos do mesmo TMDB ID viram 1 card (evita duplicatas visuais)
- **Verificacao M3U** — checa se o conteudo ja existe na playlist (por poster hash + titulo + ano)
- **Notificacao 2-canais** — BotBot.chat (primario) + whatsapp-web.js (fallback)
- **Reenvio em lote** — reenviar notificacoes dos ultimos 50 pedidos
- **Contestacao** — revendedor pode responder rejeicao (max 2x) e voltar pra pendente
- **Sincronismo M3U** — importar playlist M3U para matching de catalogo
- **Proxy TMDB** — `/api/tmdb/search` protege API key do frontend
- **Auto-migracao senhas** — senhas legadas sao convertidas para bcrypt na inicializacao
- **Seguranca** — sessao httpOnly, rate-limit de pedidos (max 10 pendentes), validacao de propriedade

## Credenciais Padrao

Criadas via `.env` e `seed.js`:
- Admin: definido em `ADMIN_USERNAME` / `ADMIN_PASSWORD` no `.env`
- Revendedores: criados via `/revenda/register` ou `seed.js`

## API Endpoints

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/requests` | GET | Listar pedidos (filtros: status, category, search) |
| `/api/requests/:id` | GET | Detalhe do pedido |
| `/api/requests/:id/status` | POST | Aprovar/rejeitar (+ sync) |
| `/api/requests` | POST | Criar pedido |
| `/api/requests/:id` | DELETE | Deletar pedido (admin) |
| `/api/requests/:id/respond` | POST | Contestar rejeicao (revenda) |
| `/api/requests/revenda/:id` | DELETE | Deletar proprio pedido (revenda) |
| `/api/resellers` | GET | Listar revendedores |
| `/api/resellers/:id` | GET/PUT/DELETE | CRUD revendedor |
| `/api/tmdb/search` | GET | Busca TMDB (proxy, auth revenda) |
| `/api/tmdb/:requestId` | GET | Dados TMDB de um pedido |
| `/api/whatsapp/status` | GET | Status conexao WhatsApp |
| `/api/whatsapp/start` | POST | Iniciar WhatsApp |
| `/api/whatsapp/reset` | POST | Resetar WhatsApp |
| `/api/botbot/status` | GET | Status BotBot |
| `/api/botbot/config` | POST | Configurar BotBot |
| `/api/m3u/status` | GET | Status sync M3U |
| `/api/m3u/sync` | POST | Iniciar sync M3U |
| `/api/m3u/clear` | POST | Limpar dados M3U |
| `/api/stats` | GET | Estatisticas |
| `/api/notifications/resend-all` | POST | Reenviar notificacoes em lote |

## Comandos Uteis

```bash
# Dev
npm run dev

# Producao PM2
pm2 start server.js --name "dashboard"
pm2 start whatsapp-server.js --name "whatsapp-motor"
pm2 save
pm2 startup

# Acesso
http://localhost:8080/admin/login   — Admin
http://localhost:8080/revenda/login  — Revenda
```

## Convencoes

- Backend: JS ES modules (`import/export`), nomes em ingles
- Frontend: EJS + CSS vanilla, JS vanilla
- DB: SQLite com WAL mode, migracoes seguras (safeAddColumn)
- Notificacao: BotBot primario, WhatsApp local fallback
- Pedidos: status `pending` → `approved` / `rejected`
