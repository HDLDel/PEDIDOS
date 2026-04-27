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

## 🐧 3. Como instalar no Linux (VPS Ubuntu Server)

O sistema roda totalmente via linha de comando (**sem necessidade de interface gráfica/desktop**). 
1. **Prepare o sistema**: O Ubuntu Server precisa de algumas bibliotecas básicas para que o navegador interno funcione em modo "oculto" (headless). Use o script que preparamos:
   ```bash
   chmod +x setup-ubuntu.sh
   ./setup-ubuntu.sh
   ```
2. **Instale as dependências do Node**:
   ```bash
   npm install
   ```

### Como Rodar no Linux (com PM2):
Para que o sistema não desligue quando você fechar o terminal, usamos o **PM2**:

1. **Iniciar o Site:**
   ```bash
   pm2 start server.js --name "dashboard"
   ```
2. **Iniciar o Motor do WhatsApp:**
   ```bash
   pm2 start whatsapp-server.js --name "whatsapp-motor"
   ```
3. **Salvar para ligar junto com o PC:**
   ```bash
   pm2 save
   pm2 startup
   ```

---

## 🚀 4. Como acessar

*   **Painel Administrativo:** `http://IP_DA_SUA_VPS:8080/admin/login`
*   **Portal do Revendedor:** `http://IP_DA_SUA_VPS:8080/revenda/login`
*   **Conexão do WhatsApp:** Após logar no Admin, clique no ícone do WhatsApp no topo para escanear o QR Code.

---

## 🛠️ Solução de Problemas

**"O navegador já está rodando" (The browser is already running):**
*   No **Windows**: Abra o Gerenciador de Tarefas e finalize todos os processos chamados "Chromium" ou "Chrome".
*   No **Linux**: Rode `pm2 restart whatsapp-motor`.

**O WhatsApp não conecta:**
*   Verifique se o seu servidor do WhatsApp (Porta 8880) está ligado.
*   Certifique-se de que a pasta `.wwebjs_auth` tem permissão de escrita.

---

## 📝 Comandos Úteis (Linux)
*   `pm2 logs`: Ver o que está acontecendo em tempo real.
*   `pm2 restart all`: Reiniciar tudo.
*   `pm2 stop all`: Parar tudo.

---

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

### O que este README faz:
1.  **Simplifica a Instalação**: Traduz termos técnicos para ações simples como "Abra o terminal" ou "Baixe do site oficial".
2.  **Explica a Arquitetura**: Deixa claro que existem dois serviços que precisam rodar juntos.
3.  **Dá autonomia na VPS**: Inclui os comandos do PM2, que são essenciais para quem vai hospedar o sistema de verdade.
4.  **Resolve Erros Comuns**: Já traz a solução para o erro de "Navegador travado" que estávamos discutindo.

Basta salvar esse conteúdo em um arquivo chamado `README.md` na raiz do seu projeto!

<!--
[PROMPT_SUGGESTION]Crie um arquivo start_all.bat para Windows que abre as duas janelas automaticamente com um clique[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]Adicione uma seção no README explicando como configurar o Nginx para usar um domínio (ex: painel.meusite.com)[/PROMPT_SUGGESTION]
->



Escondendo o /revenda/login (URL Masking com Workers)
Mesmo que o seu servidor redirecione internamente o / para /revenda/login, o navegador do usuário mostrará o caminho completo. Para "mascarar" isso e fazer com que a tela de login apareça diretamente em gestorpedidos.click/ sem mudar a URL, use um Cloudflare Worker:

Vá em Workers & Pages > Create application > Create Worker.
Dê um nome (ex: mask-login) e clique em Deploy.
Clique em Edit Code e cole este script:
javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Se o usuário acessar a raiz "/"
    if (url.pathname === "/") {
      // O Worker busca o conteúdo do login, mas mantém a URL como "/"
      const loginUrl = `${url.origin}/revenda/login`;
      return fetch(loginUrl, request);
    }

    // Para todas as outras rotas, segue o fluxo normal
    return fetch(request);
  },
};
Configurar a Rota:
Volte para as configurações do Worker.
Vá em Triggers > Routes > Add Route.
Coloque: gestorpedidos.click/*
Selecione a Zona: gestorpedidos.click.




