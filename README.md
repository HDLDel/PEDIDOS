# 🎬 VOD Premium - Gestor de Pedidos

Este sistema permite gerenciar pedidos de filmes, séries e reportes de erro para um portal de VOD. Ele conta com um painel para o Administrador e um portal para os Revendedores, além de notificações automáticas via WhatsApp.

---

## ⚙️ 1. Configuração Inicial (Obrigatório para Windows e Linux)

Antes de ligar o sistema, você precisa criar um arquivo chamado `.env` na pasta principal do projeto e colar o seguinte conteúdo, preenchendo com seus dados:

```env
SESSION_SECRET=uma_frase_aleatoria_e_longa_aqui

# Dados do Administrador Mestre
ADMIN_USERNAME=seu_usuario
ADMIN_PASSWORD=sua_senha_forte
ADMIN_NAME="<ADMIN_NAME>"

# Chave da API do TMDB (Obtenha em themoviedb.org)
TMDB_API_KEY=sua_chave_aqui
```

---

## 🪟 2. Como instalar no Windows

1. **Instale o Node.js**: Baixe e instale a versão "LTS" do site oficial nodejs.org.
2. **Abra o Terminal**: Vá na pasta do projeto e abra o PowerShell ou CMD.
3. **Instale as dependências**:
   ```bash
   npm install
   ```

### Como Rodar no Windows:
Você precisará de **duas janelas** do terminal abertas:

*   **Janela 1 (O Site):**
    ```bash
    npm run dev
    ```
*   **Janela 2 (O WhatsApp):**
    ```bash
    node whatsapp-server.js
    ```

---

## 🐧 3. Instalação no Linux (VPS Ubuntu Server)

Consulte o guia completo em [`INSTALL.md`](INSTALL.md) na raiz do projeto.

---

## 🚀 4. Como acessar

*   **Painel Administrativo:** `http://IP_DA_SUA_VPS:8901/admin/login`
*   **Portal do Revendedor:** `http://IP_DA_SUA_VPS:8901/revenda/login`
*   **Conexão do WhatsApp:** Após logar no Admin, clique no ícone do WhatsApp no topo para escanear o QR Code.

---

## 🛠️ Solução de Problemas

**"O navegador já está rodando" (The browser is already running):**
*   No **Windows**: Abra o Gerenciador de Tarefas e finalize todos os processos chamados "Chromium" ou "Chrome".
*   No **Linux**: Rode `pm2 restart whatsapp-motor`.

**O WhatsApp não conecta:**
*   Verifique se o seu servidor do WhatsApp (Porta 8902) está ligado.
*   Certifique-se de que a pasta `.wwebjs_auth` tem permissão de escrita.

---

## 📝 Comandos Úteis (Linux)
*   `pm2 logs`: Ver o que está acontecendo em tempo real.
*   `pm2 restart all`: Reiniciar tudo.
*   `pm2 stop all`: Parar tudo.

---
### node

rm -rf node_modules package-lock.json
npm install
npm rebuild better-sqlite3clear

## 🛠️ Tecnologias e Módulos

O sistema foi construído utilizando tecnologias modernas de back-end e front-end para garantir performance e escalabilidade.

### Backend (Node.js)
- **Express**: Framework web principal.
- **Better-SQLite3**: Banco de dados relacional rápido para persistência de pedidos e usuários.
- **BcryptJS**: Criptografia de alta segurança para armazenamento de senhas.
- **Express-Session**: Controle de acesso e persistência de login.
- **Dotenv**: Gerenciamento de configurações e chaves de API.
- **EJS**: Renderização de templates HTML dinâmicos.

### Automação e Notificações
- **WhatsApp-Web.js**: Motor para envio de notificações em tempo real.
- **Puppeteer**: Navegador interno (Headless) para suporte ao motor de mensagens.

### Frontend
- **CSS3 (Grid/Flexbox)**: Layout "Dark Premium" responsivo.
- **JavaScript (Vanilla)**: Interatividade client-side sem dependências pesadas.
- **Tampermonkey Scripts**: Auxiliares para integração rápida com TMDB e preenchimento de motivos.

### Infraestrutura
- **PM2**: Monitoramento e gerenciamento de processos em produção.
- **Google Chrome (Stable)**: Necessário para o motor de notificações em servidores Linux.

```

> Consulte [`INSTALL.md`](INSTALL.md) para instalação completa.
