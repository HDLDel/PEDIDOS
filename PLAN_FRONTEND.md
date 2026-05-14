# Plano de Implementação - Frontend VOD Premium

## Baseado na imagem Gestor.png

---

## Layout Identificado

### 1. Estrutura Geral
- **Full-width**, sem sidebar
- Fundo muito escuro (quase preto)
- Cards verticais em grid horizontal (5 por linha no exemplo)

### 2. Menu Superior (Abas de Categoria)
- **Séries** | **Filmes** | **Erros Reportados**
- Aba ativa: texto vermelho com sublinhado vermelho
- Abas inativas: texto cinza

### 3. Contadores de Status (Filtros)
- Três botões com números:
  - **Pendentes** — fundo vermelho (ativo/selecionado)
  - **Aprovados** — fundo cinza
  - **Rejeitados** — fundo cinza
- Estilo: pills/badges arredondados

### 4. Cards de Solicitação

**Estrutura do card (de cima para baixo):**
1. **Poster** — imagem da obra (proporção 2:3 aprox)
2. **Badge de Status** — botão "PENDENTE" com contorno amarelo (centralizado)
3. **Área de Dados** — caixa cinza escura com informações:
   - **Título** em destaque
   - **Tipo:** Série/Filme
   - **Ação:** Adicionar ao catálogo / Reportar erro / Solicitar temporada
   - **Temporada:** (quando aplicável)
   - **Episódio(s):** (quando aplicável)
   - **Solicitante:** Nome + ícone de "proibido" (bloquear)
   - **WhatsApp:** (XX) XXXXX-XXXX
   - **Data:** DD/MM/AAAA HH:MM
4. **Botões de Ação** (3 botões na parte inferior):
   - **Ver no TMDB** — azul preenchido
   - **Aprovar** — contorno verde
   - **Rejeitar** — contorno vermelho

---

## Arquivos a Editar

| Arquivo | O que fazer |
|---------|-------------|
| `models/RequestModel.js` | Expandir para ~30 registros mockados com campos completos (whatsapp, action, episode, requestType, description, etc.) |
| `views/dashboard.ejs` | Reescrever completamente: header, abas, filtros de status, grid de cards com todos os elementos descritos |
| `public/css/style.css` | Reescrever completamente: tema dark, abas, badges de status, cards, botões de ação, tipografia |
| `server.js` | Manter como está (já serve o dashboard corretamente) |

---

## Dados Mockados a Adicionar

Campos novos no model:
- `whatsapp`: string formatada
- `action`: 'Adicionar ao catálogo' | 'Reportar erro' | 'Solicitar temporada' | 'Solicitar episódio'
- `episode`: string (ex: "13- 14- 15" ou "2")
- `requestType`: 'content' | 'error' | 'season' | 'episode'
- `description`: texto do erro ou solicitação
- `year`: ano da obra

---

## Estilos CSS a Criar

- Variáveis: cores de fundo, cards, botões, textos, status
- Header fixo com logo
- Abas de categoria (vermelho ativo, cinza inativo)
- Badges de status (vermelho=pendente, verde=aprovado, cinza=rejeitado)
- Cards: borda arredondada, sombra, hover
- Área de dados do card: fundo cinza escuro
- Botões: TMDB (azul sólido), Aprovar (contorno verde), Rejeitar (contorno vermelho)
- Ícone de bloquear solicitante
- Grid responsivo

---

## Interatividade (JavaScript inline no EJS)

- Filtro por categoria (Séries/Filmes/Erros) — esconde/mostra cards
- Filtro por status (Pendentes/Aprovados/Rejeitados) — esconde/mostra cards
- Contadores atualizam dinamicamente
- Ícone de bloquear solicitante (visual apenas, mockado)

---

## Passos de Implementação

1. **Model** — Expandir dados mockados com campos completos
2. **CSS** — Criar todo o tema visual
3. **Dashboard EJS** — Estrutura HTML completa
4. **Testar** — Rodar servidor e validar visual

---

## Aprovação

Após sua confirmação, implemento todos os arquivos.
