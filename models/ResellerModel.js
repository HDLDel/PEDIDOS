import db from '../db.js';

export class ResellerModel {
  static getAll() {
    return db.prepare('SELECT * FROM resellers ORDER BY name ASC').all();
  }

  static getById(id) {
    return db.prepare('SELECT * FROM resellers WHERE id = ?').get(id);
  }

  static getByEmail(email) {
    return db.prepare('SELECT * FROM resellers WHERE email = ?').get(email);
  }

  static getOrCreateByName({ name, email, phone, whatsapp }) {
    const existing = db.prepare('SELECT * FROM resellers WHERE name = ?').get(name);
    if (existing) return existing;

    const stmt = db.prepare(`
      INSERT INTO resellers (name, email, phone, whatsapp)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, email, phone || '', whatsapp);
    return this.getById(result.lastInsertRowid);
  }

  static create({ name, email, phone, whatsapp, password }) {
    // Nota: Em produção, a senha deve ser criptografada com bcrypt
    const stmt = db.prepare(`
      INSERT INTO resellers (name, email, phone, whatsapp, password)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, email, phone || '', whatsapp, password || '<SENHA>');
    return this.getById(result.lastInsertRowid);
  }

  static authenticate(email, password) {
    return db.prepare('SELECT * FROM resellers WHERE email = ? AND password = ?')
             .get(email, password);
  }
}