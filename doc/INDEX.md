# PEDIDOS — Documentação

**Projeto:** Gestor de Pedidos VOD  
**Stack:** Node.js / Express / SQLite / EJS  
**Dominio:** gestorpedidos.click

---

## Índice da Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `API.md` | Todos os endpoints REST, métodos, parâmetros |
| `INSTALL.md` | Guia de instalação passo a passo (raiz do projeto) |
| `ARQUITETURA.md` | Estrutura do código, fluxo de dados, modelos |
| `REGRAS_SKILLS.md` | Regras de interação para IAs, skills disponíveis |
| `NOTIFICACAO.md` | Sistema de notificação (BotBot.chat + WhatsApp) |
| `inicio.md` | Mapa rápido do projeto (stack, estrutura, comandos) |
| `M3U.md` | Parsing e cruzamento de playlists M3U |
| `BOTBOT_SETUP.md` | API v2 BotBot.chat (credenciais, endpoints) |
| `proxxyreverso.txt` | Configuração Nginx proxy reverso |

## Comandos Rápidos

```bash
npm run dev              # Desenvolvimento
pm2 start server.js      # Produção
pm2 start whatsapp-server.js  # Motor WhatsApp
bash nginx/control.sh start   # Iniciar nginx (porta 8900)
```
