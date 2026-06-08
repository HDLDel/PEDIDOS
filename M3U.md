# Guia Completo: Parsing, Normalização e Cruzamento de M3U (Node.js & Python)

Este documento detalha o funcionamento passo a passo do sistema de cruzamento de playlists M3U com pedidos do catálogo e fornece uma implementação completa pronta para uso em **Python**.

---

## 📐 Fluxo Arquitetural da Solução

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

## 🛠️ Lógica de Limpeza e Normalização

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

## 🐍 Implementação em Python

Abaixo está o código em **Python** equivalente ao nosso sistema em JavaScript, utilizando expressões regulares e o módulo nativo `sqlite3`.

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
                    current_item = {
                        "name": name,
                        "group_title": group_title,
                        "logo_hash": logo_hash,
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
                        "logo_hash": current_item["logo_hash"]
                    })
                current_item = None

        return results
```

---

## 🔍 Como Fazer a Comparação e Cruzamento

Para comparar um pedido com os dados importados do M3U, utilize a seguinte lógica estruturada de decisão:

```python
def check_if_exists_in_m3u(request_item, m3u_titles_set, m3u_logos_set) -> dict:
    """
    Verifica se o pedido (request_item) já está presente na M3U.
    Retorna um dicionário indicando sucesso e qual nome bateu.
    """
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

    # 2. RASTREAMENTO ESTRITO POR TÍTULO + TIPO
    # Comparamos os títulos possíveis (Digitado, Traduzido e Original)
    match_titles = [
        request_item.get("title"),
        request_item.get("tmdb_title"),
        request_item.get("tmdb_original_title")
    ]
    # Remove valores nulos/vazios
    match_titles = [t for t in match_titles if t]

    for title in match_titles:
        # Limpar metadados do título do pedido
        clean_title = M3uProcessor.clean_series_name(title)
        norm_title = M3uProcessor.normalize_title(clean_title)
        
        # Chave estrita por tipo: ex: "series:from" ou "movie:divertidamente"
        key = f"{request_item['type']}:{norm_title}"
        if key in m3u_titles_set:
            return {
                "matched": True,
                "reason": "Por título e tipo",
                # Aqui você buscaria no banco o título exato que gerou esse norm_title
                "m3u_title": title 
            }

    return {"matched": False, "reason": "Não encontrado na M3U", "m3u_title": ""}
```

---

## ⚡ Estratégia de Deduplicação em Memória (Performance)

M3U de provedores costumam conter mais de 50.000 linhas. Para garantir um processamento ultra rápido no Python:

1. **Deduplicação de VODs**: Remova duplicatas no Python antes de mandar para o banco, guardando chaves únicas em um dicionário:
   ```python
   unique_items = {}
   for item in parsed_items:
       key = f"{item['type']}:{item['normalized_title']}"
       if key not in unique_items:
           unique_items[key] = item
   ```
2. **Bulk Insert (SQLite Transação)**: Insira os dados em lote usando `executemany` dentro de uma transação. Isso faz a inserção de milhares de linhas demorar menos de 100ms.
   ```python
   cursor.execute("BEGIN TRANSACTION;")
   cursor.execute("DELETE FROM m3u_contents;")
   cursor.executemany(
       "INSERT INTO m3u_contents (title, type, normalized_title, logo_hash) VALUES (?, ?, ?, ?);",
       [(i['title'], i['type'], i['normalized_title'], i['logo_hash']) for i in unique_items.values()]
   )
   cursor.execute("COMMIT;")
   ```
