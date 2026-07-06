# Instalação — PEDIDOS VOD

---

## Pré-requisitos

- Node.js 18+ (LTS)
- NPM
- Git (opcional)

---

## 1. Configuração Inicial

Clone ou copie o projeto e instale as dependências:

```bash
npm install
```

Crie o arquivo `.env` na raiz:

```env
SESSION_SECRET=uma_frase_aleatoria_muito_longa

ADMIN_USERNAME=seu_usuario_admin
ADMIN_PASSWORD=sua_senha_forte_hash
ADMIN_NAME="<ADMIN_NAME>"

TMDB_API_KEY=sua_chave_tmdb

WHATSAPP_API_URL=<WHATSAPP_API_URL>
WHATSAPP_ENABLED=true
WHATSAPP_API_TOKEN=token_hex_64_caracteres
```

---

## 2. Windows

Duas janelas de terminal necessárias:

**Janela 1 (Site):**
```bash
npm run dev
```

**Janela 2 (WhatsApp):**
```bash
node whatsapp-server.js
```

Acesso: `http://localhost:8901/admin/login`

---

## 3. Linux (VPS Ubuntu)

### Setup automático:

```bash
chmod +x setup-ubuntu.sh
./setup-ubuntu.sh
npm install
```

### Produção com PM2:

```bash
pm2 start server.js --name "dashboard"
pm2 start whatsapp-server.js --name "whatsapp-motor"
pm2 save
pm2 startup
```

### Terceiro Nginx (proxy reverso, porta 8900):

O sistema usa um nginx separado (fora do nginx do sistema) escutando na porta `8900`, com proxy reverso para o Node na porta `8901`.

```bash
# Setup inicial (criar diretórios e copiar binário)
mkdir -p /root/PEDIDOS/nginx/{sbin,conf,logs,run}
cp /home/xui/bin/nginx/sbin/nginx /root/PEDIDOS/nginx/sbin/
cp nginx/mime.types /root/PEDIDOS/nginx/conf/

# Deploy da config
cp nginx/terceiro-nginx.conf /root/PEDIDOS/nginx/conf/nginx.conf

# Iniciar
/root/PEDIDOS/nginx/sbin/nginx \
  -c /root/PEDIDOS/nginx/conf/nginx.conf \
  -p /root/PEDIDOS/nginx
```

Ou usar o script helper:

```bash
bash nginx/control.sh start
bash nginx/control.sh stop
bash nginx/control.sh reload
```

Configuração (`nginx/terceiro-nginx.conf`):

```nginx
server {
    listen 8900;
    server_name gestorpedidos.click www.gestorpedidos.click;

    location / {
        proxy_pass http://127.0.0.1:8901;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Cloudflare Worker (URL masking):

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const loginUrl = `${url.origin}/revenda/login`;
      return fetch(loginUrl, request);
    }
    return fetch(request);
  },
};
```

---

## 4. Acesso

| Rota | Descrição |
|------|-----------|
| `http://localhost:8901/admin/login` | Painel Admin |
| `http://localhost:8901/revenda/login` | Portal Revendedor |
| `http://localhost:8901/revenda/register` | Cadastro Revendedor |

---

## 5. Solução de Problemas

| Problema | Solução |
|----------|---------|
| Navegador já rodando | `pm2 restart whatsapp-motor` (Linux) / Finalizar Chromium (Windows) |
| WhatsApp não conecta | Verificar `.wwebjs_auth` com permissão de escrita |
| Porta 8901 ocupada | Verificar com `ss -tlnp \| grep 8901` |
| Porta 8900 ocupada | Verificar com `ss -tlnp \| grep 8900` |
| WhatsApp não conecta | Verificar porta 8902: `ss -tlnp \| grep 8902` |

### Rebuild better-sqlite3:

```bash
rm -rf node_modules package-lock.json
npm install
npm rebuild better-sqlite3
```

---

## Dependências

```json
{
  "express": "^4.19.2",
  "better-sqlite3": "^12.9.0",
  "bcryptjs": "^2.4.3",
  "ejs": "^3.1.9",
  "express-session": "^1.18.0",
  "dotenv": "^16.4.5",
  "whatsapp-web.js": "^1.23.0",
  "qrcode": "^1.5.3",
  "cookie-parser": "^1.4.7"
}
```
