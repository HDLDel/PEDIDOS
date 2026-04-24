import db from '../db.js';

export class RequestModel {
  // GET com join no reseller para manter compatibilidade com frontend
  static getAll() {
    return db.prepare(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.status,
        r.action,
        r.season,
        r.episode,
        r.request_type as requestType,
        r.description,
        r.rejection_reason as rejectionReason,
        r.date,
        r.time,
        r.created_at,
        res.name as reseller,
        res.whatsapp,
        COALESCE(t.poster_path, 'https://via.placeholder.com/500x750?text=Sem+Poster') as poster,
        t.year,
        t.vote_average as voteAverage
      FROM requests r
      JOIN resellers res ON r.reseller_id = res.id
      LEFT JOIN tmdb_contents t ON r.id = t.request_id
      ORDER BY r.id DESC
    `).all();
  }

  static getById(id) {
    return db.prepare(`
      SELECT 
        r.*,
        res.name as reseller,
        res.whatsapp,
        res.email,
        res.phone,
        t.tmdb_id as tmdbId,
        t.poster_path as poster,
        t.backdrop_path as backdrop,
        t.overview,
        t.vote_average as voteAverage,
        t.year
      FROM requests r
      JOIN resellers res ON r.reseller_id = res.id
      LEFT JOIN tmdb_contents t ON r.id = t.request_id
      WHERE r.id = ?
    `).get(id);
  }

  static getByStatus(status) {
    return db.prepare(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.status,
        r.action,
        r.season,
        r.episode,
        r.request_type as requestType,
        r.description,
        r.date,
        r.time,
        res.name as reseller,
        res.whatsapp,
        COALESCE(t.poster_path, 'https://via.placeholder.com/500x750?text=Sem+Poster') as poster,
        t.year,
        t.vote_average as voteAverage
      FROM requests r
      JOIN resellers res ON r.reseller_id = res.id
      LEFT JOIN tmdb_contents t ON r.id = t.request_id
      WHERE r.status = ?
      ORDER BY r.id DESC
    `).all(status);
  }

  static getByCategory(category) {
    if (category === 'error') {
      return db.prepare(`
        SELECT 
          r.id,
          r.title,
          r.type,
          r.status,
          r.action,
          r.season,
          r.episode,
          r.request_type as requestType,
          r.description,
          r.date,
          r.time,
          res.name as reseller,
          res.whatsapp,
          COALESCE(t.poster_path, 'https://via.placeholder.com/500x750?text=Sem+Poster') as poster,
          t.year,
          t.vote_average as voteAverage
        FROM requests r
        JOIN resellers res ON r.reseller_id = res.id
        LEFT JOIN tmdb_contents t ON r.id = t.request_id
        WHERE r.request_type = 'error'
        ORDER BY r.id DESC
      `).all();
    }
    
    return db.prepare(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.status,
        r.action,
        r.season,
        r.episode,
        r.request_type as requestType,
        r.description,
        r.date,
        r.time,
        res.name as reseller,
        res.whatsapp,
        COALESCE(t.poster_path, 'https://via.placeholder.com/500x750?text=Sem+Poster') as poster,
        t.year,
        t.vote_average as voteAverage
      FROM requests r
      JOIN resellers res ON r.reseller_id = res.id
      LEFT JOIN tmdb_contents t ON r.id = t.request_id
      WHERE r.type = ?
      ORDER BY r.id DESC
    `).all(category);
  }

  static search(query) {
    const q = `%${query.toLowerCase()}%`;
    return db.prepare(`
      SELECT 
        r.id,
        r.reseller_id,
        r.title,
        r.type,
        r.status,
        r.action,
        r.season,
        r.episode,
        r.request_type as requestType,
        r.description,
        r.date,
        r.time,
        res.name as reseller,
        res.whatsapp,
        COALESCE(t.poster_path, 'https://via.placeholder.com/500x750?text=Sem+Poster') as poster,
        t.year,
        t.vote_average as voteAverage
      FROM requests r
      JOIN resellers res ON r.reseller_id = res.id
      LEFT JOIN tmdb_contents t ON r.id = t.request_id
      WHERE LOWER(r.title) LIKE ? OR LOWER(res.name) LIKE ?
      ORDER BY r.id DESC
    `).all(q, q);
  }

  static getStats() {
    const row = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM requests
    `).get();
    return {
      pending: row.pending || 0,
      approved: row.approved || 0,
      rejected: row.rejected || 0
    };
  }

  static create({ resellerId, title, type, status, action, season, episode, requestType, description, date, time }) {
    const stmt = db.prepare(`
      INSERT INTO requests 
      (reseller_id, title, type, status, action, season, episode, request_type, description, date, time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(resellerId, title, type, status || 'pending', action || 'Adicionar ao catálogo', season, episode, requestType || 'content', description, date, time);
    return this.getById(result.lastInsertRowid);
  }

  static updateStatus(id, status, rejectionReason = null) {
    const stmt = db.prepare(`
      UPDATE requests 
      SET status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(status, rejectionReason, id);
    return this.getById(id);
  }

  static update(id, fields) {
    const allowed = ['title', 'type', 'status', 'action', 'season', 'episode', 'request_type', 'description', 'date', 'time'];
    const sets = [];
    const values = [];
    
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (sets.length === 0) return null;
    
    values.push(id);
    const stmt = db.prepare(`
      UPDATE requests 
      SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(...values);
    return this.getById(id);
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM requests WHERE id = ?');
    return stmt.run(id);
  }
}
