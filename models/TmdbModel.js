import db from '../db.js';

export class TmdbModel {
  static getByRequestId(requestId) {
    return db.prepare('SELECT * FROM tmdb_contents WHERE request_id = ?').get(requestId);
  }

  static create({ requestId, tmdbId, title, originalTitle, year, posterPath, backdropPath, overview, voteAverage }) {
    const stmt = db.prepare(`
      INSERT INTO tmdb_contents 
      (request_id, tmdb_id, title, original_title, year, poster_path, backdrop_path, overview, vote_average)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(requestId, tmdbId, title, originalTitle, year, posterPath || null, backdropPath || null, overview, voteAverage);
    return this.getById(result.lastInsertRowid);
  }

  static getById(id) {
    return db.prepare('SELECT * FROM tmdb_contents WHERE id = ?').get(id);
  }

  static update(requestId, fields) {
    const allowed = ['tmdb_id', 'title', 'original_title', 'year', 'poster_path', 'backdrop_path', 'overview', 'vote_average'];
    const sets = [];
    const values = [];
    
    for (const [key, value] of Object.entries(fields)) {
      const dbKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      if (allowed.includes(dbKey)) {
        sets.push(`${dbKey} = ?`);
        values.push(value);
      }
    }
    
    if (sets.length === 0) return null;
    
    values.push(requestId);
    const stmt = db.prepare(`
      UPDATE tmdb_contents 
      SET ${sets.join(', ')}, fetched_at = CURRENT_TIMESTAMP 
      WHERE request_id = ?
    `);
    stmt.run(...values.map(val => (val === '' ? null : val))); // Converte strings vazias para null
    return this.getByRequestId(requestId);
  }

  static deleteByRequestId(requestId) {
    const stmt = db.prepare('DELETE FROM tmdb_contents WHERE request_id = ?');
    return stmt.run(requestId);
  }

  // Buscar na API do TMDB e salvar
  static async fetchAndSave(requestId, title, type, tmdbId = null) {
    const apiKey = process.env.TMDB_API_KEY;
    const endpoint = type === 'series' ? 'tv' : 'movie';
    
    try {
      let url;
      if (tmdbId) {
        // Se temos o ID, buscamos o conteúdo exato
        url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${apiKey}&language=pt-BR`;
      } else {
        // Fallback: busca por texto (menos preciso)
        url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=pt-BR&page=1`;
      }

      const response = await fetch(url);
      const data = await response.json();

      // Se for busca por ID, os dados estão na raiz do JSON. Se for busca por texto, estão em data.results[0]
      const item = tmdbId ? data : (data.results && data.results.length > 0 ? data.results[0] : null);
      
      if (item) {
        const itemName = item.name || item.title;
        const itemDate = item.first_air_date || item.release_date || '';
        const releaseDate = itemDate ? itemDate.split('-').reverse().join('/') : null;
        
        const existing = this.getByRequestId(requestId);
        const tmdbData = {
          requestId,
          tmdbId: item.id,
          title: itemName,
          originalTitle: item.original_name || item.original_title,
          year: releaseDate, // Agora armazena a data completa (ex: 15/05/2024)
          posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
          overview: item.overview,
          voteAverage: item.vote_average
        };
        
        if (existing) {
          return this.update(requestId, tmdbData);
        } else {
          return this.create(tmdbData);
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar TMDB:', error);
      return null;
    }
  }
}
