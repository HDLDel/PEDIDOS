import db from '../db.js';
import fs from 'fs';
import path from 'path';

export class M3uModel {
  // Normaliza o título para comparação (remove acentos, espaços, caracteres especiais, anos e tags de episódios)
  static normalizeTitle(title) {
    if (!title) return '';
    let normalized = title.toString().toLowerCase();
    
    // Remover colchetes e parênteses e seu conteúdo (ex: [Dual Audio], (Legendado), (2022))
    normalized = normalized.replace(/\[[^\]]*\]/g, '');
    normalized = normalized.replace(/\([^\)]*\)/g, '');
    
    // Remover acentos e diacríticos
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Remover anos isolados
    normalized = normalized.replace(/[\(\[\s]*\b\d{4}\b[\)\]\s]*/g, '');
    
    // Remover palavras chaves comuns de qualidade e áudio
    normalized = normalized.replace(/\b(dublado|legendado|dual|multi|audio|legendas|leg|dub|fhd|hd|4k|uhd|sd)\b/g, '');
    
    // Remover tags de temporadas/episódios que possam estar no nome do filme/série
    normalized = normalized.replace(/\bs\d+e\d+\b/g, '');
    normalized = normalized.replace(/\b(temporada|temp|capitulo|cap|ep|t)\s*\d+/g, '');
    
    // Reter apenas letras e números
    normalized = normalized.replace(/[^a-z0-9]/g, '');
    
    return normalized;
  }

  // Remove marcas de episódios/temporadas para extrair o nome limpo da série
  static cleanSeriesName(title) {
    if (!title) return '';
    let cleaned = title.toString();
    
    // Remover colchetes e parênteses e seu conteúdo
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\([^\)]*\)/g, '');
    
    // Remover termos comuns de áudio, legenda e qualidade
    cleaned = cleaned.replace(/\b(dublado|legendado|dual|multi|audio|legendas|leg|dub|fhd|hd|4k|uhd|sd)\b/gi, '');
    
    // Remover padrões comuns como S01E02, S1E1, etc.
    cleaned = cleaned.replace(/\bS\d+E\d+\b/gi, '');
    
    // Remover padrões como S01 ou E01 isolados
    cleaned = cleaned.replace(/\bS\d+\b/gi, '');
    cleaned = cleaned.replace(/\bE\d+\b/gi, '');
    
    // Remover termos como "Temporada X", "Temp X", "Capítulo X", "T X", "Ep X" etc.
    cleaned = cleaned.replace(/\b(temporada|temp|capitulo|cap|ep|episodio|t)\s*\d+/gi, '');
    
    // Remover termos de ordinalidade em português como "3ª Temporada" ou "2ª Temp"
    cleaned = cleaned.replace(/\b\d+\s*(ª|ª\s*temporada|ª\s*temp)\b/gi, '');
    
    // Remover pontuações soltas no início ou no fim após as substituições
    cleaned = cleaned.replace(/[\s\-\(\)\[\]\:\,\|\/\\_]+$/, '');
    cleaned = cleaned.replace(/^[\s\-\(\)\[\]\:\,\|\/\\_]+/, '');
    
    // Limpar espaços duplicados
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  // Realiza o parsing de uma playlist M3U e retorna lista de filmes/séries e episódios
  static parseM3u(content) {
    const lines = content.split(/\r?\n/);
    const results = [];
    const episodes = [];
    let currentItem = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        // Obter group-title
        const groupTitleMatch = line.match(/group-title="([^"]+)"/i);
        const groupTitle = groupTitleMatch ? groupTitleMatch[1] : '';

        // Ignorar se o grupo de títulos tiver "canais" (Canais ao vivo)
        if (groupTitle.toLowerCase().includes('canais')) {
          currentItem = null;
          continue;
        }

        // Extrair tvg-logo para rastreamento de banner do TMDB
        const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/i);
        let logoHash = '';
        if (tvgLogoMatch) {
          const logoUrl = tvgLogoMatch[1];
          const slashIndex = logoUrl.lastIndexOf('/');
          if (slashIndex !== -1) {
            logoHash = logoUrl.substring(slashIndex + 1).trim().toLowerCase();
          }
        }

        // Extrair nome após a última vírgula
        const commaIndex = line.lastIndexOf(',');
        let name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : '';

        // Fallback: se não tiver nome pós-vírgula, tenta tvg-name
        if (!name) {
          const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
          name = tvgNameMatch ? tvgNameMatch[1] : '';
        }

        if (name) {
          // Extrair ano do título (1900-2099) antes de qualquer outra limpeza
          const yearMatch = name.match(/\b(19\d{2}|20\d{2})\b/);
          const itemYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

          currentItem = {
            name,
            groupTitle,
            logoHash,
            year: itemYear,
            normalizedName: this.normalizeTitle(name)
          };
        } else {
          currentItem = null;
        }
      } else if (line.startsWith('http') && currentItem) {
        const url = line;
        let type = 'movie';

        const groupLower = currentItem.groupTitle.toLowerCase();
        const urlLower = url.toLowerCase();

        // Identificar tipo pelo grupo ou URL
        if (groupLower.includes('series') || groupLower.includes('série') || urlLower.includes('/series/')) {
          type = 'series';
          // Extrair info do episódio ANTES de limpar o nome
          const epMatch = currentItem.name.match(/\bS(\d+)E(\d+)\b/i);
          if (epMatch) {
            episodes.push({
              seriesNormalized: this.normalizeTitle(this.cleanSeriesName(currentItem.name)),
              seriesTitle: this.cleanSeriesName(currentItem.name),
              episodeLabel: currentItem.name,
              season: parseInt(epMatch[1], 10),
              episode: parseInt(epMatch[2], 10),
              logoHash: currentItem.logoHash
            });
          }
          currentItem.name = this.cleanSeriesName(currentItem.name);
          currentItem.normalizedName = this.normalizeTitle(currentItem.name);
        } else if (groupLower.includes('filmes') || groupLower.includes('filme') || urlLower.includes('/movie/')) {
          type = 'movie';
        } else {
          // Fallback por padrão de nome de arquivo
          if (/\bS\d+E\d+\b/i.test(currentItem.name) || /\b(temporada|temp|t)\s*\d+/i.test(currentItem.name)) {
            type = 'series';
            const epMatch = currentItem.name.match(/\bS(\d+)E(\d+)\b/i);
            if (epMatch) {
              episodes.push({
                seriesNormalized: this.normalizeTitle(this.cleanSeriesName(currentItem.name)),
                seriesTitle: this.cleanSeriesName(currentItem.name),
                episodeLabel: currentItem.name,
                season: parseInt(epMatch[1], 10),
                episode: parseInt(epMatch[2], 10),
                logoHash: currentItem.logoHash
              });
            }
            currentItem.name = this.cleanSeriesName(currentItem.name);
            currentItem.normalizedName = this.normalizeTitle(currentItem.name);
          }
        }

        if (currentItem.normalizedName) {
          results.push({
            title: currentItem.name,
            type,
            normalizedTitle: currentItem.normalizedName,
            logoHash: currentItem.logoHash,
            year: currentItem.year
          });
        }
        currentItem = null;
      }
    }

    return { items: results, episodes };
  }

  // Executa o sincronismo da playlist M3U e salva no banco de dados
  static async syncM3u(source) {
    let m3uContent = '';

    if (!source) {
      source = this.getSetting('M3U_SOURCE', 'exemplo.m3u');
    }

    console.log(`⏳ Iniciando sincronização M3U a partir de: ${source}`);

    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Baixar do link remoto
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Erro ao baixar playlist M3U (Status HTTP ${response.status})`);
      }
      m3uContent = await response.text();
    } else {
      // Ler arquivo local (padrão é relativo à raiz do projeto)
      const filePath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo local M3U não encontrado no caminho: ${filePath}`);
      }
      m3uContent = fs.readFileSync(filePath, 'utf-8');
    }

    // Fazer parsing dos canais e VODs da playlist
    const { items: parsedItems, episodes } = this.parseM3u(m3uContent);
    console.log(`🔍 Total de itens extraídos da M3U: ${parsedItems.length}`);
    console.log(`📺 Total de episódios extraídos: ${episodes.length}`);

    // Remover duplicatas em JS antes de salvar no SQLite para manter performance excepcional
    // Chave única inclui o ano para permitir duplicatas de títulos homônimos/remakes (ex: Tudo é Possível 2012 vs 2022)
    const uniqueMap = new Map();
    for (const item of parsedItems) {
      const key = `${item.type}:${item.normalizedTitle}:${item.year || ''}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    const uniqueItems = Array.from(uniqueMap.values());
    console.log(`✨ Total de itens únicos após remoção de duplicatas: ${uniqueItems.length}`);

    // Inserir no banco de dados usando uma transação para velocidade máxima
    const insertTransaction = db.transaction((items) => {
      // Limpar tabelas antigas
      db.prepare('DELETE FROM m3u_contents').run();
      db.prepare('DELETE FROM m3u_episodes').run();

      const insertStmt = db.prepare(`
        INSERT INTO m3u_contents (title, type, normalized_title, logo_hash, year)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertStmt.run(item.title, item.type, item.normalizedTitle, item.logoHash, item.year);
      }

      // Inserir episódios
      const insertEpStmt = db.prepare(`
        INSERT INTO m3u_episodes (series_normalized, series_title, episode_label, season, episode, logo_hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const ep of episodes) {
        insertEpStmt.run(ep.seriesNormalized, ep.seriesTitle, ep.episodeLabel, ep.season, ep.episode, ep.logoHash);
      }
    });

    insertTransaction(uniqueItems);

    // Salvar configurações e estatísticas no banco
    const moviesCount = uniqueItems.filter(i => i.type === 'movie').length;
    const seriesCount = uniqueItems.filter(i => i.type === 'series').length;
    const nowStr = new Date().toLocaleString('pt-BR');

    const stats = {
      movies: moviesCount,
      series: seriesCount,
      date: nowStr
    };

    this.setSetting('M3U_SOURCE', source);
    this.setSetting('M3U_LAST_SYNC', nowStr);
    this.setSetting('M3U_STATS', JSON.stringify(stats));

    console.log(`✅ Sincronização M3U concluída! ${moviesCount} filmes e ${seriesCount} séries importados.`);
    return stats;
  }

  // Busca todos os dados da M3U em Sets para comparação eficiente
  static getM3uData() {
    try {
      const rows = db.prepare('SELECT title, normalized_title, type, logo_hash, year FROM m3u_contents').all();
      const titleMap = new Map();
      const logoSet = new Set();
      for (const row of rows) {
        const key = `${row.type}:${row.normalized_title}`;
        if (!titleMap.has(key)) {
          titleMap.set(key, []);
        }
        titleMap.get(key).push({
          title: row.title,
          year: row.year,
          logoHash: row.logo_hash,
          normalizedTitle: row.normalized_title
        });

        if (row.logo_hash) {
          logoSet.add(row.logo_hash);
        }
      }
      return { titleMap, logoSet };
    } catch (e) {
      return { titleMap: new Map(), logoSet: new Set() };
    }
  }

  // Busca episódios de uma série na M3U
  static getEpisodes(normalizedTitle) {
    try {
      return db.prepare(`
        SELECT episode_label, season, episode, logo_hash
        FROM m3u_episodes
        WHERE series_normalized = ?
        ORDER BY season, episode
      `).all(normalizedTitle);
    } catch (e) {
      return [];
    }
  }

  // Busca todos os títulos normalizados em um Set de strings "tipo:titulo_normalizado"
  static getNormalizedTitles() {
    const data = this.getM3uData();
    return new Set(data.titleMap.keys());
  }

  // Helpers simples para ler/gravar configurações globais na tabela settings
  static getSetting(key, defaultValue = '') {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row ? row.value : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  static setSetting(key, value) {
    try {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    } catch (e) {
      console.error(`Erro ao salvar configuração ${key}:`, e.message);
    }
  }

  // Limpa todos os dados importados da M3U e as configurações associadas
  static clearM3u() {
    const clearTransaction = db.transaction(() => {
      db.prepare('DELETE FROM m3u_contents').run();
      db.prepare('DELETE FROM m3u_episodes').run();
      db.prepare('DELETE FROM settings WHERE key IN (?, ?, ?)').run('M3U_SOURCE', 'M3U_LAST_SYNC', 'M3U_STATS');
    });
    clearTransaction();
    console.log('✅ Dados da M3U limpos com sucesso no banco.');
  }
}
