# INSTALAÇÃO DO PEDIDOS VOD

Guia simples pra instalar o sistema do zero.

---

## ANTES DE COMEÇAR

Você precisa ter:
- Um servidor Ubuntu (já configurado com XUI ou não)
- Acesso SSH (root)
- Um domínio apontado pra Cloudflare

---

## PASSO 1 — Enviar os arquivos pro servidor

Tem duas opções:

### Opção A — Git (se tiver git no servidor)

```bash
cd /root
git clone SEU_REPOSITORIO_AQUI PEDIDOS
cd PEDIDOS
```

### Opção B — SFTP (sem git)

Use o script de deploy (só pra enviar os arquivos):

```bash
python3 .agents/skills/deploy-dedicado/scripts/deploy.py
```

Mas primeiro abra esse arquivo e confira o IP e senha:

```
nano .agents/skills/deploy-dedicado/scripts/deploy.py
```

Lá no começo do arquivo tem:

```python
hostname = "IP_DO_SERVIDOR"
username = "root"
password = "SENHA_DO_SERVIDOR"
```

Depois de enviar, conecte no servidor via SSH:

```bash
ssh root@IP_DO_SERVIDOR
cd /root/PEDIDOS
```

---

## PASSO 2 — Rodar o setup

Dentro da pasta do projeto no servidor:

```bash
bash setup-ubuntu.sh
```

Esse script faz tudo sozinho:
- Instala Node.js (versão 20)
- Instala Google Chrome (pro WhatsApp)
- Instala PM2 (pra manter os programas rodando)
- Instala as dependências do projeto
- Cria o arquivo .env pra você configurar
- Cria as pastas pro nginx que vamos usar

Pode demorar alguns minutos.

---

## PASSO 3 — Configurar o .env

Edite o arquivo .env que foi criado:

```bash
nano .env
```

Preencha com seus dados:

```
ADMIN_USERNAME=seu_usuario_admin
ADMIN_PASSWORD=sua_senha_forte
ADMIN_NAME="<ADMIN_NAME>"
TMDB_API_KEY=sua_chave_do_tmdb
WHATSAPP_API_URL=<WHATSAPP_API_URL>
```

Salve (Ctrl+X, Y, Enter).

---

## PASSO 4 — Preparar o nginx

O sistema usa um nginx separado (não mexe no nginx do XUI).

Copie o arquivo de tipos MIME:

```bash
cp /home/xui/bin/nginx/conf/mime.types /root/PEDIDOS/nginx/conf/
```

---

## PASSO 5 — Ligar tudo

```bash
# Ligar o site
pm2 start server.js --name "dashboard"

# Ligar o WhatsApp
pm2 start whatsapp-server.js --name "whatsapp-motor"

# Ligar o nginx (porta 8900)
bash nginx/control.sh start

# Salvar pro PM2 ligar sozinho se o servidor reiniciar
pm2 save
pm2 startup
```

---

## PASSO 6 — Configurar o Cloudflare

No painel da Cloudflare, no registro DNS do seu domínio:

1. Tipo: **A**
2. Nome: **@** (ou o subdomínio que quiser)
3. Conteúdo: **IP do servidor**
4. Proxy: **Ligado** (laranja)
5. Origin Port: **8900**

Depois de salvar, o sistema fica acessível em:

```
https://SEUDOMINIO/admin/login
```

O Cloudflare recebe na porta 80/443 e encaminha pro servidor na porta 8900. O usuário não precisa digitar porta nenhuma.

---

## PRONTO!

Seu sistema já deve estar no ar. Se algo der errado, veja os logs:

```bash
pm2 logs          # logs do Node
bash nginx/control.sh status   # status do nginx
```

---

## PRA ATUALIZAR (quando mudar o código)

```bash
python3 .agents/skills/deploy-dedicado/scripts/deploy.py
```

Esse script:
1. Para os processos
2. Envia os arquivos novos
3. Instala dependências novas
4. Reinicia o nginx
5. Liga tudo de novo
