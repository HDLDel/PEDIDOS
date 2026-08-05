# DOCUMENTAÇÃO — PEDIDOS VOD

Documentação técnica do sistema de gestão de pedidos VOD.

---

## Índice

1. [API do Sistema](#1-api-do-sistema)
   - [Base URL](#base-url)
   - [Autenticação](#autenticação)
   - [Pedidos (Requests)](#pedidos-requests)
   - [Revendedores](#revendedores)
   - [TMDB](#tmdb)
   - [WhatsApp](#whatsapp)
   - [BotBot](#botbot)
   - [M3U](#m3u)
   - [Stats](#stats)
   - [Notificações](#notificações)
2. [Notificações](#2-notificações)
   - [Arquitetura](#arquitetura)
   - [BotBot.chat API (Primário)](#botbotchat-api-primário)
   - [WhatsApp Local (Fallback)](#whatsapp-local-fallback)
   - [Reenvio em Lote](#reenvio-em-lote)
   - [Configuração no .env](#configuração-no-env)
3. [M3U — Parsing, Normalização e Cruzamento](#3-m3u--parsing-normalização-e-cruzamento)
   - [Fluxo Arquitetural](#fluxo-arquitetural)
   - [Lógica de Limpeza e Normalização](#lógica-de-limpeza-e-normalização)
   - [Implementação em Python](#implementação-em-python)
   - [Como Fazer a Comparação e Cruzamento](#como-fazer-a-comparação-e-cruzamento)
   - [Estratégia de Deduplicação em Memória](#estratégia-de-deduplicação-em-memória)

---

# 1. API do Sistema

## Base URL

```
http://localhost:8901
https://gestorpedidos.click (produção)
```

---

## Autenticação

Sessão via `express-session` com cookie httpOnly + secure.

### Admin

```
POST /admin/login
Body: { username, password }
Success: redirect /dashboard
```

### Revendedor

```
POST /revenda/login
Body: { username, password }
Success: redirect /revenda/dashboard

POST /revenda/register
Body: { name, username, password, phone, store }
```

---

## Pedidos (Requests)

### Listar pedidos

```
GET /api/requests?status=pending&category=movie&search=termo
```

| Query | Tipo | Descrição |
|-------|------|-----------|
| status | string | pending, approved, rejected |
| category | string | movie, series, error |
| search | string | Busca por título |
| limit | number | Limite de resultados |
| offset | number | Paginação |

### Detalhe do pedido

```
GET /api/requests/:id
```

### Criar pedido

```
POST /api/requests
Body: {
  "title": "Nome do Filme",
  "type": "movie" | "series" | "error",
  "category": "ação" | "comédia" | etc,
  "tmdb_id": 123456,
  "tmdb_title": "Título TMDB",
  "tmdb_original_title": "Original Title",
  "year": 2024,
  "poster_path": "/path/to/poster.jpg",
  "reseller_id": 1,
  "episodes": "1ª Temporada" (opcional),
  "reason": "Erro no player" (se type=error)
}
```

### Aprovar/Rejeitar

```
POST /api/requests/:id/status
Body: { "status": "approved" | "rejected", "reason": "Motivo" (se rejected) }
```

### Deletar pedido (admin)

```
DELETE /api/requests/:id
```

### Contestar rejeição (revenda)

```
POST /api/requests/:id/respond
Body: { "message": "Justificativa" }
```
Max 2 contestações por pedido.

### Deletar próprio pedido (revenda)

```
DELETE /api/requests/revenda/:id
```

---

## Revendedores

### Listar

```
GET /api/resellers
```

### CRUD

```
GET    /api/resellers/:id
PUT    /api/resellers/:id  Body: { name, username, phone, store, active }
DELETE /api/resellers/:id
```

---

## TMDB

### Busca (proxy)

```
GET /api/tmdb/search?q=nome+do+filme&type=movie
```

| Query | Descrição |
|-------|-----------|
| q | Termo de busca |
| type | movie ou series |

Protege a API key do frontend.

### Dados TMDB do pedido

```
GET /api/tmdb/:requestId
```

---

## WhatsApp

### Status

```
GET /api/whatsapp/status
```

Retorna: `{ connected: bool, qrCode: string|null }`

### Iniciar

```
POST /api/whatsapp/start
```

### Resetar

```
POST /api/whatsapp/reset
```

---

## BotBot

### Status

```
GET /api/botbot/status
```

### Configurar

```
POST /api/botbot/config
Body: { appKey, authKey, phone, enabled }
```

---

## M3U

### Status sync

```
GET /api/m3u/status
```

### Iniciar sync

```
POST /api/m3u/sync
```

### Limpar dados

```
POST /api/m3u/clear
```

---

## Stats

### Gerais

```
GET /api/stats
```

Retorna totais de pedidos, revendedores, taxas de aprovação.

---

## Notificações

### Reenvio em lote

```
POST /api/notifications/resend-all
```

Reenvia notificações dos últimos 50 pedidos pendentes.

---

# 2. Notificações

Sistema de notificação em 2 canais: BotBot.chat API (primário) + WhatsApp local (fallback).

## Arquitetura

```
[Pedido aprovado/rejeitado]
          │
          ▼
┌─────────────────────┐
│  BotBotService.js   │ ← Tenta primeiro
│  (API BotBot.chat)  │
└─────────┬───────────┘
          │
     Sucesso? ── Sim ──> Fim
          │
         Não
          ▼
┌─────────────────────┐
│ WhatsAppService.js  │ ← Fallback
│ (whatsapp-web.js)   │
└─────────┬───────────┘
          │
     Sucesso? ── Sim ──> Fim
          │
         Não
          ▼
    Log de erro
```

---

## BotBot.chat API (Primário)

### Credenciais

```
AppKey: <BOTBOT_APP_KEY>
AuthKey: <BOTBOT_AUTH_KEY>
```

### Endpoint

```
POST https://botbot.chat/api/v2/sendText
```

### Headers

```
Content-Type: application/json
appKey: <APP_KEY>
authKey: <AUTH_KEY>
```

### Payload

```json
{
  "to": "<TELEFONE_TESTE>",
  "message": "Texto da notificação",
  "typingDelay": 1
}
```

### Teste via curl

```bash
curl -X POST https://botbot.chat/api/v2/sendText \
  -H "Content-Type: application/json" \
  -H "appKey: <BOTBOT_APP_KEY>" \
  -H "authKey: <BOTBOT_AUTH_KEY>" \
  -d '{"to": "<TELEFONE_TESTE>", "message": "Teste", "typingDelay": 1}'
```

### Respostas

| Código | Significado |
|--------|-------------|
| 200 | Sucesso (`messageStatus: "Success"`) |
| 400 | Bad request |
| 401 | Unauthorized (AppKey inválido ou dispositivo offline) |
| 500 | Erro upstream WhatsApp |

---

## WhatsApp Local (Fallback)

### Serviços

| Arquivo | Função |
|---------|--------|
| `WhatsAppService.js` | Classe principal (whatsapp-web.js) |
| `whatsapp-server.js` | Servidor standalone na porta 8902 |
| `whatsapp-worker.js` | Worker para processamento em background |

### Fluxo

```bash
# Iniciar motor WhatsApp
pm2 start whatsapp-server.js --name "whatsapp-motor"

# Verificar status
curl http://localhost:8902/status
```

### API do WhatsApp Server

```
GET  /status       → Status da conexão + QR code
POST /start        → Iniciar sessão
POST /reset        → Resetar sessão
POST /send         → Enviar mensagem (Body: { to, message })
```

### QR Code

Após iniciar, o QR code aparece no painel admin (`/admin/whatsapp`). Escaneie com o WhatsApp para conectar.

---

## Reenvio em Lote

```
POST /api/notifications/resend-all
```

Reenvia notificações dos últimos 50 pedidos pendentes. Útil quando o serviço fica offline temporariamente.

---

## Configuração no .env

```env
# BotBot
BOTBOT_APP_KEY=<BOTBOT_APP_KEY>
BOTBOT_AUTH_KEY=<BOTBOT_AUTH_KEY>
BOTBOT_PHONE=<TELEFONE_TESTE>
BOTBOT_ENABLED=true

# WhatsApp Local
WHATSAPP_API_URL=<WHATSAPP_API_URL>
WHATSAPP_ENABLED=true
WHATSAPP_API_TOKEN=token_hex_64_caracteres
```

---

# 3. M3U — Parsing, Normalização e Cruzamento

Este documento detalha o funcionamento passo a passo do sistema de cruzamento de playlists M3U com pedidos do catálogo e fornece uma implementação completa pronta para uso em **Python**.

## Fluxo Arquitetural

O cruzamento é feito em 4 etapas bem definidas:

```
[Playlist M3U] ──> [1. Parser & Filtro] ──> [2. Limpeza & Normalização] ──> [3. Persistência SQLite]
                                                                                      │
                                                                                      ▼
[Pedidos TMDB] ───────────────────────────────────────────────> [4. Comparador de Precisão]
```

1. **Parser & Filtro**: Leitura linha a linha do arquivo. Canais ao vivo são ignorados e são extraídos o título original do stream, o grupo, a URL e o pôster (`tvg-logo`).
2. **Limpeza e Normalização**: Remoção de ruídos (colchetes, parênteses, qualidades, idiomas) e redução do título a caracteres alfanuméricos simples.
3. **Persistência**: Eliminação de duplicatas em memória e salvamento no banco de dados SQLite.
4. **Comparador de Precisão**: Validação em duas etapas: por hash de imagem do pôster (100% precisa) e por título estrito ao tipo (evitando misturar filmes e séries homônimos).

---

## Lógica de Limpeza e Normalização

As playlists M3U possuem muitos ruídos (como `[Dual Audio]`, `S01E02`, `(4K)`). Para fazer a comparação de strings funcionar, as seguintes funções tratam esses ruídos:

### 1. Limpeza de Metadados (`clean_series_name`)
- Remove colchetes e parênteses e todo o seu conteúdo (ex: `[Dual]` ou `(Leg)`).
- Remove tags avulsas de áudio e qualidade (ex: `dublado`, `fhd`, `hd`, `4k`).
- Remove padrões de episódios/temporadas de séries (ex: `S01E02`, `Temporada 1`, `3ª Temp`).
- Remove pontuações soltas e hífens das pontas.

### 2. Normalização de String (`normalize_title`)
- Remove acentos e diacríticos (ex: `á` -> `a`, `ç` -> `c`).
- Remove qualquer ano avulso de quatro dígitos (ex: `2024`).
- Remove qualquer caractere que não seja uma letra (`a-z`) ou número (`0-9`).

---

## Implementação em Python

Abaixo está o código em **Python** equivalente ao sistema em JavaScript, utilizando expressões regulares e o módulo nativo `sqlite3`.

```python
import re
import unicodedata
import os
import urllib.parse

class M3uProcessor:
    @staticmethod
    def normalize_title(title: str) -> str:
        """
        Normaliza o título para comparação (remove acentos, anos, tags e caracteres especiais).
        """
        if not title:
            return ""

        # Converte para minúsculas
        normalized = str(title).lower()

        # Remove colchetes e parênteses e seus conteúdos, ex: [Dual Audio], (2022)
        normalized = re.sub(r'\[[^\]]*\]', '', normalized)
        normalized = re.sub(r'\([^\)]*\)', '', normalized)

        # Remove acentos e diacríticos (Unicode normalização NFD)
        normalized = ''.join(
            c for c in unicodedata.normalize('NFD', normalized)
            if unicodedata.category(c) != 'Mn'
        )

        # Remove anos isolados de 4 dígitos
        normalized = re.sub(r'\b\d{4}\b', '', normalized)

        # Remove palavras-chave comuns de áudio, legenda e qualidade
        tags_pattern = r'\b(dublado|legendado|dual|multi|audio|legendas|leg|dub|fhd|hd|4k|uhd|sd)\b'
        normalized = re.sub(tags_pattern, '', normalized)

        # Remove tags de temporadas/episódios
        normalized = re.sub(r'\bs\d+e\d+\b', '', normalized)
        normalized = re.sub(r'\b(temporada|temp|capitulo|cap|ep|t)\s*\d+', '', normalized)

        # Mantém apenas letras e números
        normalized = re.sub(r'[^a-z0-9]', '', normalized)

        return normalized

    @staticmethod
    def clean_series_name(title: str) -> str:
        """
        Remove marcas de episódios, temporadas e tags mantendo o nome base da série limpo.
        """
        if not title:
            return ""

        cleaned = str(title)

        # Remove colchetes e parênteses e seus conteúdos
        cleaned = re.sub(r'\[[^\]]*\]', '', cleaned)
        cleaned = re.sub(r'\([^\)]*\)', '', cleaned)

        # Remove tags de qualidade e áudio (case-insensitive)
        tags_pattern = r'\b(dublado|legendado|dual|multi|audio|legendas|leg|dub|fhd|hd|4k|uhd|sd)\b'
        cleaned = re.sub(tags_pattern, '', cleaned, flags=re.IGNORECASE)

        # Remove S01E02, S1E1, s01e01
        cleaned = re.sub(r'\bS\d+E\d+\b', '', cleaned, flags=re.IGNORECASE)

        # Remove S01 ou E02 soltos
        cleaned = re.sub(r'\bS\d+\b', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\bE\d+\b', '', cleaned, flags=re.IGNORECASE)

        # Remove "Temporada X", "Temp X", "T X", "Ep X"
        cleaned = re.sub(r'\b(temporada|temp|capitulo|cap|ep|episodio|t)\s*\d+', '', cleaned, flags=re.IGNORECASE)

        # Remove "3ª Temporada", "2ª Temp"
        cleaned = re.sub(r'\b\d+\s*(ª|ª\s*temporada|ª\s*temp)\b', '', cleaned, flags=re.IGNORECASE)

        # Remove hífens, barras, espaços e pontuações soltas nas pontas
        cleaned = re.sub(r'[\s\-\(\)\[\]\:\,\|\/\\_]+$', '', cleaned)
        cleaned = re.sub(r'^[\s\-\(\)\[\]\:\,\|\/\\_]+', '', cleaned)

        # Limpa espaços duplicados
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        return cleaned

    @classmethod
    def parse_m3u(cls, m3u_content: str):
        """
        Faz o parsing das linhas do arquivo M3U extraindo os títulos e hashes de pôster.
        """
        lines = m3u_content.splitlines()
        results = []
        current_item = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith('#EXTINF:'):
                # 1. Ignorar canais ao vivo (contêm "canais" no group-title)
                group_match = re.search(r'group-title="([^"]+)"', line, re.IGNORECASE)
                group_title = group_match.group(1) if group_match else ""

                if "canais" in group_title.lower():
                    current_item = None
                    continue

                # 2. Extrair Hash de Pôster do TMDB da tag tvg-logo
                logo_match = re.search(r'tvg-logo="([^"]+)"', line, re.IGNORECASE)
                logo_hash = ""
                if logo_match:
                    logo_url = logo_match.group(1)
                    parsed_url = urllib.parse.urlparse(logo_url)
                    logo_hash = os.path.basename(parsed_url.path).strip().lower()

                # 3. Extrair nome após a última vírgula
                comma_index = line.rfind(',')
                name = line[comma_index + 1:].strip() if comma_index != -1 else ""

                if not name:
                    tvg_name_match = re.search(r'tvg-name="([^"]+)"', line, re.IGNORECASE)
                    name = tvg_name_match.group(1) if tvg_name_match else ""

                if name:
                     # Extrair ano do título (1900-2099) antes de qualquer outra limpeza
                     year_match = re.search(r'\b(19\d{2}|20\d{2})\b', name)
                     item_year = int(year_match.group(1)) if year_match else None

                     current_item = {
                         "name": name,
                         "group_title": group_title,
                         "logo_hash": logo_hash,
                         "year": item_year,
                         "normalized_name": cls.normalize_title(name)
                     }
                else:
                    current_item = None

            elif line.startswith('http') and current_item:
                url = line
                type_ = 'movie'

                group_lower = current_item["group_title"].lower()
                url_lower = url.lower()

                # Identificação inteligente do tipo (Filme vs Série)
                if "series" in group_lower or "série" in group_lower or "/series/" in url_lower:
                    type_ = 'series'
                    current_item["name"] = cls.clean_series_name(current_item["name"])
                    current_item["normalized_name"] = cls.normalize_title(current_item["name"])
                elif "filmes" in group_lower or "filme" in group_lower or "/movie/" in url_lower:
                    type_ = 'movie'
                else:
                    # Fallback por padrão de nome de arquivo
                    if re.search(r'\bS\d+E\d+\b', current_item["name"], re.IGNORECASE) or \
                       re.search(r'\b(temporada|temp|t)\s*\d+', current_item["name"], re.IGNORECASE):
                        type_ = 'series'
                        current_item["name"] = cls.clean_series_name(current_item["name"])
                        current_item["normalized_name"] = cls.normalize_title(current_item["name"])

                if current_item["normalized_name"]:
                    results.append({
                        "title": current_item["name"],
                        "type": type_,
                        "normalized_title": current_item["normalized_name"],
                        "logo_hash": current_item["logo_hash"],
                        "year": current_item["year"]
                    })
                current_item = None

        return results
```

---

## Como Fazer a Comparação e Cruzamento

Para comparar um pedido com os dados importados do M3U, utilize a seguinte lógica estruturada de decisão:

```python
def check_if_exists_in_m3u(request_item, m3u_titles_map, m3u_logos_set) -> dict:
    """
    Verifica se o pedido (request_item) já está presente na M3U.
    Retorna um dicionário indicando sucesso e qual nome bateu.
    """
    # Helper para extrair ano de 4 dígitos de data do TMDB
    def get_4digit_year(year_val):
        if not year_val:
            return None
        match = re.search(r'\b(19\d{2}|20\d{2})\b', str(year_val))
        return int(match.group(1)) if match else None

    # 1. RASTREAMENTO POR PÔSTER DO TMDB (100% de Precisão)
    # Evita falsos positivos como o filme "A Origem" (Inception) bater com a série "Origem" (FROM)
    if request_item.get("poster_path"):
        poster_filename = os.path.basename(request_item["poster_path"]).strip().lower()
        if poster_filename and "placeholder" not in poster_filename:
            if poster_filename in m3u_logos_set:
                return {
                    "matched": True,
                    "reason": "Por pôster do TMDB",
                    "m3u_title": "Identificado por Imagem"
                }

    # 2. RASTREAMENTO ESTRITO POR TÍTULO, TIPO E ANO
    # Comparamos os títulos possíveis (Digitado, Traduzido e Original)
    match_titles = [
        request_item.get("title"),
        request_item.get("tmdb_title"),
        request_item.get("tmdb_original_title")
    ]
    # Remove valores nulos/vazios
    match_titles = [t for t in match_titles if t]
    req_year = get_4digit_year(request_item.get("year"))

    for title in match_titles:
        # Limpar metadados do título do pedido
        clean_title = M3uProcessor.clean_series_name(title)
        norm_title = M3uProcessor.normalize_title(clean_title)

        # Chave estrita por tipo: ex: "series:from" ou "movie:divertidamente"
        key = f"{request_item['type']}:{norm_title}"
        if key in m3u_titles_map:
            entries = m3u_titles_map[key]
            matched_entry = None

            if req_year:
                # 1. Tenta correspondência exata de ano
                matched_entry = next((e for e in entries if e.get("year") == req_year), None)
                # 2. Fallback para itens sem ano especificado na M3U
                if not matched_entry:
                    matched_entry = next((e for e in entries if not e.get("year")), None)
            else:
                matched_entry = entries[0]

            if matched_entry:
                return {
                    "matched": True,
                    "reason": f"Por título e tipo" + (f" (Ano: {matched_entry['year']})" if matched_entry.get('year') else ""),
                    "m3u_title": matched_entry["title"]
                }

    return {"matched": False, "reason": "Não encontrado na M3U", "m3u_title": ""}
```

---

## Estratégia de Deduplicação em Memória (Performance)

M3U de provedores costumam conter mais de 50.000 linhas. Para garantir um processamento ultra rápido no Python:

1. **Deduplicação de VODs**: Remova duplicatas no Python antes de mandar para o banco, guardando chaves únicas em um dicionário (incluindo o ano para não remover remakes homônimos):
   ```python
   unique_items = {}
   for item in parsed_items:
       key = f"{item['type']}:{item['normalized_title']}:{item['year'] or ''}"
       if key not in unique_items:
           unique_items[key] = item
   ```
2. **Bulk Insert (SQLite Transação)**: Insira os dados em lote usando `executemany` dentro de uma transação. Isso faz a inserção de milhares de linhas demorar menos de 100ms.
   ```python
   cursor.execute("BEGIN TRANSACTION;")
   cursor.execute("DELETE FROM m3u_contents;")
   cursor.executemany(
       "INSERT INTO m3u_contents (title, type, normalized_title, logo_hash, year) VALUES (?, ?, ?, ?, ?);",
       [(i['title'], i['type'], i['normalized_title'], i['logo_hash'], i['year']) for i in unique_items.values()]
   )
   cursor.execute("COMMIT;")
   ```
