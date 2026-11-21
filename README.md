# 🎬 PEDIDOS VOD — Gestor de Pedidos

Sistema web para gerenciar pedidos de filmes, séries e reportes de erro de um portal VOD.

A aplicação tem um **painel administrativo**, um **portal do revendedor** e **notificações automáticas via WhatsApp**. A busca de títulos usa a API do TMDB e o cruzamento de catálogo trabalha com playlists M3U.

---

## ✨ Funcionalidades

- Gestão de pedidos com aprovação, rejeição e contestação do revendedor.
- Cadastro e administração de revendedores.
- Busca de filmes e séries via proxy da API TMDB — a chave fica no servidor.
- Notificações em dois canais: **BotBot.chat** (primário) e **WhatsApp local** (fallback).
- Reenvio em lote das notificações dos últimos pedidos.
- Importação, normalização e cruzamento de playlists M3U com o catálogo.
- Estatísticas de pedidos, revendedores e taxa de aprovação.
- Interface responsiva em tema escuro.

---

## 🏗️ Arquitetura

```
Cliente (web / WhatsApp)
        │ HTTPS
        ▼
Nginx (reverse proxy, porta 8900)
        │ proxy HTTP
        ▼
Express + EJS (porta 8901) ────── SQLite (models/)
        │ status do pedido
        ▼
BotBotService / WhatsAppService ── Gateway WhatsApp
```

O diagrama interativo está em [`doc/architecture.html`](doc/architecture.html). A definição editável das views está em [`doc/pedidos.architecture.json`](doc/pedidos.architecture.json).

### Tecnologias

| Camada | Ferramentas |
|--------|-------------|
| Backend | Node.js, Express, EJS, Express-Session |
| Dados | better-sqlite3 |
| Segurança | bcryptjs, dotenv |
| Notificações | whatsapp-web.js, BotBot.chat API v2 |
| Infraestrutura | Nginx, PM2, Cloudflare |
| Frontend | CSS3 (Grid/Flexbox), JavaScript vanilla |

---

## 📁 Estrutura

| Caminho | Conteúdo |
|---------|----------|
| `server.js` | API e rotas do painel/portal |
| `db.js` | Conexão, schema e migrações SQLite |
| `models/` | Admin, Reseller, Request, Tmdb e M3U |
| `views/admin/` | Telas do administrador |
| `views/revenda/` | Telas do revendedor |
| `public/` | CSS e JavaScript do cliente |
| `WhatsAppService.js`, `whatsapp-server.js`, `whatsapp-worker.js` | Motor de mensagens |
| `BotBotService.js`, `apibotbot/` | Integração com a API BotBot.chat |
| `script/setup-ubuntu.sh` | Instalação em VPS Ubuntu |
| `script/secure-vps.sh` | Rotação de segredos no servidor |
| `script/control.sh` | Controle do nginx dedicado |
| `nginx/` | Configuração do proxy na porta 8900 |
| `doc/` | Documentação técnica e diagramas |

---

## ✅ Pré-requisitos

- Node.js 20 (LTS) e npm.
- Google Chrome instalado no servidor — necessário pelo `whatsapp-web.js`.
- Um domínio com DNS apontado para o servidor, se for publicar.
- Para VPS: Ubuntu Server com acesso SSH.

---

## 🚀 Instalação local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo `.env` na raiz com os valores do seu ambiente.

3. Suba os dois processos em terminais separados:

   ```bash
   npm run dev
   ```

   ```bash
   node whatsapp-server.js
   ```

4. Acesse `http://localhost:8901/admin/login` e escanee o QR Code do WhatsApp no painel.

---

## 🐧 Instalação em VPS Ubuntu

O script automatiza Node.js 20, Chrome, PM2, dependências, `.env` e diretórios do nginx:

```bash
bash script/setup-ubuntu.sh
```

Depois configure o `.env`, ligue os serviços e salve o PM2:

```bash
pm2 start server.js --name "dashboard"
pm2 start whatsapp-server.js --name "whatsapp-motor"
bash script/control.sh start
pm2 save
pm2 startup
```

No Cloudflare, use um registro **A** apontando para o servidor, proxy laranja ligado e **Origin Port 8900**. O nginx recebe 80/443 e encaminha para a aplicação.

O guia completo está em [`doc/INSTALL.md`](doc/INSTALL.md).

---

## ⚙️ Configuração

Todas as credenciais ficam no `.env`, que é ignorado pelo Git. Nunca commite esse arquivo.

| Variável | Uso |
|----------|-----|
| `SESSION_SECRET` | Assinatura da sessão |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Administrador mestre |
| `ADMIN_EMAIL`, `ADMIN_PHONE` | Contato do administrador |
| `TMDB_API_KEY` | Busca de filmes e séries |
| `BOTBOT_APP_KEY`, `BOTBOT_AUTH_KEY` | API BotBot.chat |
| `BOTBOT_TEST_PHONE` | Número usado no botão "Testar" |
| `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN` | Servidor WhatsApp local |
| `WHATSAPP_ENABLED` | Habilita o fallback local |
| `PALANTIR_API_URL`, `PALANTIR_API_TOKEN`, `PALANTIR_ENABLED` | Integração opcional com Palantir |
| `NODE_ENV` | Ambiente de execução |

Exemplo mínimo:

```env
SESSION_SECRET=<FRASE_ALEATORIA_LONGA>
ADMIN_USERNAME=<USUARIO_ADMIN>
ADMIN_PASSWORD=<SENHA_FORTE>
ADMIN_NAME=<NOME_ADMIN>
TMDB_API_KEY=<CHAVE_TMDB>
WHATSAPP_API_URL=<URL_SERVIDOR_WHATSAPP>
```

Para gerar uma senha e gravar apenas o hash no banco, use `node hash-password.js "<SENHA>"`. Para trocar os segredos de uma instalação já em produção, use `script/secure-vps.sh`.

---

## 🌐 Portas

| Serviço | Porta |
|---------|-------|
| Nginx / Cloudflare Origin | 8900 |
| Painel e API Express | 8901 |
| Servidor WhatsApp | 8902 |

---

## 🔌 API

A API cobre pedidos, revendedores, TMDB, WhatsApp, BotBot, M3U, estatísticas e notificações. A autenticação usa sessão via cookie `httpOnly`.

Resumo dos endpoints:

| Grupo | Endpoints |
|-------|-----------|
| Pedidos | `GET/POST /api/requests`, `GET /api/requests/:id`, `POST /api/requests/:id/status`, `DELETE /api/requests/:id` |
| Revenda | `POST /api/requests/:id/respond`, `DELETE /api/requests/revenda/:id` |
| Revendedores | `GET /api/resellers`, `GET/PUT/DELETE /api/resellers/:id` |
| TMDB | `GET /api/tmdb/search`, `GET /api/tmdb/:requestId` |
| WhatsApp | `GET /api/whatsapp/status`, `POST /api/whatsapp/start`, `POST /api/whatsapp/reset` |
| BotBot | `GET /api/botbot/status`, `POST /api/botbot/config` |
| M3U | `GET /api/m3u/status`, `POST /api/m3u/sync`, `POST /api/m3u/clear` |
| Stats | `GET /api/stats` |
| Notificações | `POST /api/notifications/resend-all` |

Contratos, payloads e códigos de resposta: [`doc/DOCUMENTACAO.md`](doc/DOCUMENTACAO.md).

---

## 💬 Notificações

Quando um pedido é aprovado ou rejeitado, o sistema tenta o envio pela API do BotBot.chat. Se falhar, usa o WhatsApp local como fallback. Se os dois falharem, registra o erro.

O QR Code da conexão aparece no painel administrativo. O reenvio dos últimos 50 pedidos pendentes é feito por `POST /api/notifications/resend-all`.

---

## 📺 Pipeline M3U

1. **Parser e filtro** — lê a playlist, ignora canais ao vivo e extrai título, grupo, URL e pôster.
2. **Limpeza e normalização** — remove tags de áudio, qualidade, episódios, acentos e anos.
3. **Persistência** — deduplica em memória e salva no SQLite.
4. **Comparação** — cruza por hash do pôster e por título normalizado, separando filmes e séries.

O detalhamento e a implementação em Python estão em [`doc/DOCUMENTACAO.md`](doc/DOCUMENTACAO.md).

---

## 🛠️ Operação

```bash
pm2 logs                         # logs da aplicação
pm2 restart all                  # reinicia os processos
pm2 stop all                     # para os processos
bash script/control.sh status    # status do nginx
```

Solução de problemas comuns: [`doc/README.md`](doc/README.md).

---

## 📚 Documentação

- [Visão geral e solução de problemas](doc/README.md)
- [Instalação em VPS](doc/INSTALL.md)
- [Documentação técnica e API](doc/DOCUMENTACAO.md)
- [Diagrama de arquitetura](doc/architecture.html)
- [Integração BotBot.chat](apibotbot/README.md)
