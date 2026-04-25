import db from '../db.js';
import bcrypt from 'bcryptjs';

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

    const defaultPass = bcrypt.hashSync('<SENHA>', 10);
    const stmt = db.prepare(`
      INSERT INTO resellers (name, email, phone, whatsapp, password)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, email, phone || '', whatsapp, defaultPass);
    return this.getById(result.lastInsertRowid);
  }

  static create({ name, email, phone, whatsapp, password }) {
    const hashedPassword = bcrypt.hashSync(password || '<SENHA>', 10);
    const stmt = db.prepare(`
      INSERT INTO resellers (name, email, phone, whatsapp, password)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, email, phone || '', whatsapp, hashedPassword);
    return this.getById(result.lastInsertRowid);
  }

  static authenticate(email, password) {
    const reseller = db.prepare('SELECT * FROM resellers WHERE email = ?').get(email);
    
    if (!reseller) return null;

    try {
      // Tenta comparar como Bcrypt
      if (bcrypt.compareSync(password, reseller.password)) return reseller;
    } catch (e) {
      // Fallback para texto puro (usuários antigos)
      if (password === reseller.password) return reseller;
    }
    return null;
  }
}