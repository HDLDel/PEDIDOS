# 🤖 BotBot API — Documentação de Implementação

Documentação completa de como a **API BotBot.chat v2** é implementada no projeto **PEDIDOS VOD**, incluindo o código-fonte exportado e as portas usadas pelo sistema.

O objetivo deste documento é servir de **referência para reimplementação da mesma integração em outro projeto**.

---

## 📁 Estrutura desta pasta

```
apibotbot/
├── README.md                       ← este arquivo (visão geral + índice)
├── api-botbot.md                   ← especificação da API BotBot.chat v2
├── integracao-no-projeto.md        ← arquitetura, fluxo de notificação e armazenamento
├── portas.md                       ← portas usadas em todo o sistema
└── src/
    ├── BotBotService.js            ← serviço completo (cópia literal do projeto)
    ├── schema-settings.sql         ← tabela onde as chaves ficam no banco
    ├── fluxo-notificacao.js        ← orquestração aprovação/rejeição + reenvio em lote
    ├── rotas-server.js             ← rotas Express /api/botbot/* e /admin/botbot
    ├── admin-botbot.js             ← frontend da página de configuração (cópia literal)
    ├── dashboard-botbot.js         ← funções BotBot do painel principal (frontend)
    ├── whatsapp-service.js         ← fallback WhatsApp local (cópia literal)
    └── exemplo-standalone.js       ← exemplo mínimo pronto para outro projeto
```

---

## 🚀 Resumo rápido (30 segundos)

1. A API é um **POST** para `https://botbot.chat/api/v2/sendText`.
2. Autenticação por **2 headers**: `appKey` e `authKey`.
3. O projeto guarda as chaves na **tabela `settings`** do SQLite (não no `.env`).
4. Quando um pedido é **aprovado/rejeitado**, o backend chama `BotBotService.sendStatusNotification()`.
5. Se o BotBot falhar, cai no **fallback WhatsApp local** (porta 8902).
6. Curl de teste:

```bash
curl -X POST https://botbot.chat/api/v2/sendText \
  -H "Content-Type: application/json" \
  -H "appKey: SUA_APP_KEY" \
  -H "authKey: SEU_AUTH_KEY" \
  -d '{"to": "<TELEFONE_TESTE>", "message": "Teste", "typingDelay": 1}'
```

---

## 📖 Índice

| Documento | Conteúdo |
|-----------|----------|
| [`api-botbot.md`](api-botbot.md) | Endpoint, headers, payload, respostas, códigos de erro, comandos curl |
| [`integracao-no-projeto.md`](integracao-no-projeto.md) | Como o PEDIDOS integra: fluxo completo, armazenamento das chaves, rotas, frontend |
| [`portas.md`](portas.md) | Todas as portas do sistema (8901, 8902, 8900, externas) |
| [`src/BotBotService.js`](src/BotBotService.js) | Classe `BotBotService` — o coração da integração |
| [`src/exemplo-standalone.js`](src/exemplo-standalone.js) | Código mínimo para colar em qualquer projeto Node.js |

---

## 🔑 Chaves e credenciais (referência)

| Credencial | Valor | Onde é armazenada |
|-----------|-------|-------------------|
| AppKey | `<BOTBOT_APP_KEY>` | tabela `settings` (chave `BOTBOT_APP_KEY`) |
| AuthKey | `<BOTBOT_AUTH_KEY>` | tabela `settings` (chave `BOTBOT_AUTH_KEY`) |
| Telefone padrão | `<TELEFONE_TESTE>` (55 + DDD + número, Brasil) | payload `to` |

> ⚠️ **Exemplo de teste com credenciais**: dentro do projeto, o botão "Testar" envia `teste botbot` para o número informado no campo de teste (`<TELEFONE>` como padrão na view).

---

## 📌 Pontos-chave da integração neste projeto

- **Node.js** (ESM — usa `import/export`).
- Base da API: `https://botbot.chat/api/v2` (constante `BOTBOT_API`).
- O serviço expõe **4 métodos estáticos**:
  1. `getCredentials()` — lê as chaves do banco.
  2. `saveCredentials(appKey, authKey)` — grava as chaves no banco (UPSERT).
  3. `getStatus()` — verifica se o bot responde.
  4. `sendStatusNotification(request)` — envia a notificação de aprovação/rejeição.
- **Número de telefone**: sempre normalizado com DDI `55` para o Brasil.
- **Mensagem**: dividida em blocos por `\n\n` (parágrafos) e enviada com intervalo de **1,5s** para preservar a ordem/estilo no WhatsApp.
- **Fallback**: se o BotBot falhar, o `WhatsAppService` (WhatsApp local, porta 8902) assume.

Consulte [`integracao-no-projeto.md`](integracao-no-projeto.md) para o fluxo detalhado.