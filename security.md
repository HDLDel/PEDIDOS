# Relatório de Auditoria de Segurança (Security Audit)

Este documento detalha as vulnerabilidades de segurança identificadas na aplicação **PEDIDOS VOD** e fornece as recomendações de mitigação para cada falha.

---

## 🚨 Resumo dos Riscos Identificados

| ID | Vulnerabilidade | Impacto | Risco | Status |
|---|---|---|---|---|
| SEC-01 | Motor do WhatsApp Sem Autenticação e Exposto (`0.0.0.0`) | Sequestro de Sessão / Envio de Spam | **CRÍTICO** | Pendente |
| SEC-02 | DOM-based XSS via `innerHTML` no Histórico de Conversas e Tabela | Roubo de Cookie / Scripting Malicioso | **ALTO** | Pendente |
| SEC-03 | Armazenamento de Sessões em Memória (`MemoryStore`) | Perda de Sessão / Vazamento de Memória | **MÉDIO** | Pendente |
| SEC-04 | Ausência de Proteção Contra CSRF (Cross-Site Request Forgery) | Ações Não Autorizadas em Nome do Admin | **MÉDIO** | Pendente |
| SEC-05 | Ausência de Limitação de Taxa (Rate Limiting) | Força Bruta nos Logins / Negação de Serviço | **MÉDIO** | Pendente |
| SEC-06 | Cookies de Sessão Sem Atributos de Segurança (`secure`, `sameSite`) | Roubo de Cookies via HTTP / CSRF | **MÉDIO** | Pendente |
| SEC-07 | Ausência de Cabeçalhos de Segurança HTTP (Helmet) | Clickjacking, MIME-Sniffing e XSS | **BAIXO** | Pendente |
| SEC-08 | Senhas Padrão Fracas e Sem Política de Complexidade | Credenciais Fracas / Contas de Revenda Vulneráveis | **BAIXO** | Pendente |
| SEC-09 | Exposição de API Key do TMDB no Frontend | Uso não autorizado da cota da API por terceiros | **ALTO** | Pendente |
| SEC-10 | Credenciais de Administrador em Código Claro | Vazamento de credenciais administrativas no Git | **ALTO** | Pendente |
| SEC-11 | Credenciais do Provedor M3U Expostas no README | Roubo/Uso não autorizado da playlist M3U | **ALTO** | Pendente |
| SEC-12 | Dump Completo do Projeto Sem Ignorar (`repomix-output.xml`) | Exposição completa de segredos e do arquivo `.env` | **CRÍTICO** | Pendente |

---

## 🔍 Detalhamento das Vulnerabilidades e Correções

### SEC-01: Motor do WhatsApp Sem Autenticação e Exposto (`whatsapp-server.js`)
* **Descrição**: O servidor independente do WhatsApp roda na porta `8880` (`whatsapp-server.js`). Ele expõe endpoints críticos como `/send` (para enviar mensagens) e `/logout` sem qualquer tipo de autenticação ou token de validação. Por padrão, o Express faz binding em `0.0.0.0` (todas as interfaces de rede). Se a porta `8880` estiver aberta no firewall da VPS ou servidor, qualquer pessoa na internet poderá enviar mensagens em massa usando o número de WhatsApp conectado do administrador ou desconectar a conta.
* **Gravidade**: **CRÍTICO**
* **Onde ocorre**: [whatsapp-server.js](file:///c:/Users/hilde/Dev/PEDIDOS/whatsapp-server.js#L139-L142)
* **Remediação**:
  1. Restringir o binding do servidor exclusivamente para a interface local (`127.0.0.1` ou `localhost`):
     ```javascript
     app.listen(PORT, '127.0.0.1', () => { ... });
     ```
  2. Implementar um token estático compartilhado (API Key) nos headers entre `server.js` e `whatsapp-server.js`.

---

### SEC-02: DOM-based XSS via `innerHTML` no Histórico de Conversas e Tabela (`dashboard.ejs`)
* **Descrição**: No painel do administrador, os dados retornados de requisições AJAX do banco de dados (como nomes de revendedores, observações do pedido e histórico de respostas do chat) são inseridos no DOM usando a propriedade `innerHTML +=` diretamente dentro de strings interpoladas sem escape de tags HTML. Se um revendedor malicioso se registrar com um nome do tipo `Admin <img src=x onerror=alert(document.cookie)>` ou enviar uma contestação com um script embutido, esse código será executado na máquina do administrador ao abrir a conversa ou visualizar os detalhes.
* **Gravidade**: **ALTO**
* **Onde ocorre**: [dashboard.ejs](file:///c:/Users/hilde/Dev/PEDIDOS/views/dashboard.ejs#L1250-L1258) e [dashboard.ejs](file:///c:/Users/hilde/Dev/PEDIDOS/views/dashboard.ejs#L1676-L1682)
* **Remediação**:
  Criar uma função utilitária de escape no JavaScript cliente ou utilizar `textContent`/`innerText` para elementos de texto puro:
  ```javascript
  function escapeHTML(str) {
      return str.replace(/[&<>'"]/g, 
          tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
  }
  // Uso:
  tbody.innerHTML += `<td>${escapeHTML(req.reseller)}</td>`;
  ```

---

### SEC-03: Armazenamento de Sessões em Memória (`MemoryStore`) (`server.js`)
* **Descrição**: O Express está configurado para usar o gerenciador de sessões padrão em memória (`MemoryStore`). O próprio módulo exibe um alerta de que ele é propenso a vazamentos de memória (memory leaks) sob tráfego e não escala horizontalmente. Além disso, todas as sessões ativas são destruídas toda vez que o servidor reinicia, forçando administradores e revendedores a fazer login novamente.
* **Gravidade**: **MÉDIO**
* **Onde ocorre**: [server.js](file:///c:/Users/hilde/Dev/PEDIDOS/server.js#L42-L47)
* **Remediação**:
  Configurar um store persistente para as sessões, como o `connect-sqlite3` utilizando o mesmo arquivo `vod.sqlite`, ou Redis:
  ```javascript
  import session from 'express-session';
  import sqliteStore from 'connect-sqlite3';
  const SQLiteStore = sqliteStore(session);

  app.use(session({
      store: new SQLiteStore({ db: 'vod.sqlite', dir: './data' }),
      // ... outras configs
  }));
  ```

---

### SEC-04: Ausência de Proteção Contra CSRF (Cross-Site Request Forgery)
* **Descrição**: Rotas mutativas que realizam ações críticas (como deletar pedidos, aprovar/rejeitar solicitações e alterar revendedores) não exigem tokens CSRF. Se um administrador logado acessar um site malicioso externo, esse site poderá fazer requisições silenciosas em segundo plano para o painel administrador e executar ações indevidas sem o conhecimento do administrador.
* **Gravidade**: **MÉDIO**
* **Onde ocorre**: Rotas `/api/requests/:id/status`, `/api/resellers/:id`, etc. em [server.js](file:///c:/Users/hilde/Dev/PEDIDOS/server.js)
* **Remediação**:
  Adicionar a biblioteca `csurf` ou implementar tokens de proteção CSRF nas rotas estatais (POST, PUT, DELETE).

---

### SEC-05: Ausência de Limitação de Taxa (Rate Limiting)
* **Descrição**: Endpoints sensíveis como `/admin/login`, `/revenda/login`, `/revenda/register` e envio de novos pedidos `/api/requests` não possuem limite de requisições por IP. Um invasor pode disparar ataques de dicionário e força bruta (Brute Force) de forma ininterrupta para tentar adivinhar a senha de administradores ou inundar o banco de dados com requisições fantasmas (Denial of Service).
* **Gravidade**: **MÉDIO**
* **Onde ocorre**: Rotas de autenticação e criação de pedidos em [server.js](file:///c:/Users/hilde/Dev/PEDIDOS/server.js)
* **Remediação**:
  Utilizar o middleware `express-rate-limit` nos endpoints de login e cadastro:
  ```javascript
  import rateLimit from 'express-rate-limit';

  const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 10, // Limite de 10 tentativas por IP
      message: 'Muitas tentativas de login de seu IP. Tente novamente mais tarde.'
  });

  app.post('/admin/login', loginLimiter, (req, res) => { ... });
  ```

---

### SEC-06: Cookies de Sessão Sem Atributos de Segurança
* **Descrição**: A configuração de cookies de sessão atual define apenas `secure: false`. Isso permite que o cookie seja transmitido por conexões HTTP normais não seguras. Além disso, a falta da flag `sameSite` e `httpOnly` não explicitada abre margem para sequestro de cookies em ataques CSRF e XSS.
* **Gravidade**: **MÉDIO**
* **Onde ocorre**: [server.js](file:///c:/Users/hilde/Dev/PEDIDOS/server.js#L42-L47)
* **Remediação**:
  Ajustar as propriedades dos cookies de sessão no Express:
  ```javascript
  cookie: {
      secure: process.env.NODE_ENV === 'production', // true em produção (exige HTTPS)
      httpOnly: true, // Bloqueia leitura do cookie via document.cookie no client
      sameSite: 'lax', // Proteção contra ataques CSRF
      maxAge: 24 * 60 * 60 * 1000 // Expira em 1 dia
  }
  ```

---

### SEC-07: Ausência de Cabeçalhos de Segurança HTTP (Helmet)
* **Descrição**: A aplicação não envia cabeçalhos HTTP fundamentais para a proteção de aplicações web modernas, como proteção contra clickjacking (`X-Frame-Options`), injeção de MIME-Type (`X-Content-Type-Options: nosniff`) e Content Security Policy (CSP).
* **Gravidade**: **BAIXO**
* **Onde ocorre**: [server.js](file:///c:/Users/hilde/Dev/PEDIDOS/server.js)
* **Remediação**:
  Importar e aplicar o middleware `helmet` globalmente no Express:
  ```javascript
  import helmet from 'helmet';
  app.use(helmet());
  ```

---

### SEC-08: Senhas Padrão Fracas e Sem Política de Complexidade
* **Descrição**: A aplicação define a senha padrão `"<SENHA>"` para novos revendedores criados por importações rápidas. Não há validação de tamanho mínimo de senha nem requisitos de complexidade (letras, números, caracteres especiais) no cadastro de revendas ou administradores.
* **Gravidade**: **BAIXO**
* **Onde ocorre**: [ResellerModel.js](file:///c:/Users/hilde/Dev/PEDIDOS/models/ResellerModel.js#L21) e formulário de registro.
* **Remediação**:
  1. Impedir a criação ou ativação de revendedores com a senha `"<SENHA>"`. Exigir que alterem no primeiro acesso.
  2. Implementar regex de validação de força de senha no middleware ou nos models.

---

## 💡 Sugestões de Melhorias Adicionais (Exposição de Credenciais)

### SEC-09: Exposição de API Key do TMDB no Frontend
* **Descrição**: A chave de API do TMDB está hardcoded no arquivo EJS de busca de filmes, rodando do lado do cliente. Isso expõe a credencial para qualquer usuário do painel de revendas.
* **Gravidade**: **ALTO**
* **Onde ocorre**: [buscar-filme.ejs](file:///c:/Users/hilde/Dev/PEDIDOS/views/revenda/buscar-filme.ejs#L152)
* **Remediação**:
  Substituir a chamada direta pelo endpoint proxy que já existe no backend (`/api/tmdb/search?query=...`), que faz a chamada utilizando a variável do `.env` de forma protegida.

---

### SEC-10: Credenciais de Administrador em Código Claro (`add_admin.js`)
* **Descrição**: O script de criação de administrador contém credenciais em texto claro. Caso o arquivo seja mantido no repositório Git, o usuário e a senha da conta de admin serão vazados.
* **Gravidade**: **ALTO**
* **Onde ocorre**: [add_admin.js](file:///c:/Users/hilde/Dev/PEDIDOS/add_admin.js#L6-L10)
* **Remediação**:
  Ler as credenciais diretamente do arquivo `.env` ou solicitar a senha interativamente via terminal durante a execução do script.

---

### SEC-11: Credenciais do Provedor M3U Expostas no README (`readme.md`)
* **Descrição**: O arquivo de documentação `readme.md` possui um exemplo com uma URL de playlist ativa contendo usuário e senha do provedor real em texto limpo.
* **Gravidade**: **ALTO**
* **Onde ocorre**: [readme.md](file:///c:/Users/hilde/Dev/PEDIDOS/readme.md#L184)
* **Remediação**:
  Mascarar as credenciais alterando os parâmetros na documentação para valores genéricos (ex: `username=SEU_USUARIO&password=SUA_SENHA`).

---

### SEC-12: Dump Completo do Projeto Sem Ignorar (`repomix-output.xml`)
* **Descrição**: O arquivo `repomix-output.xml` concentra todos os arquivos do projeto em formato XML, incluindo o arquivo `.env` de produção com chaves, tokens e segredos ativos. Como este arquivo não estava ignorado no `.gitignore`, ele correria o risco de ser enviado para o repositório Git.
* **Gravidade**: **CRÍTICO**
* **Onde ocorre**: Raiz do projeto.
* **Remediação**:
  Garantir que a regra criada no `.gitignore` impeça o rastreamento deste arquivo e apagar o dump gerado.
