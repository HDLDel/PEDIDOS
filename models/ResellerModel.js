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

    return bcrypt.compareSync(password, reseller.password) ? reseller : null;
  }

  static update(id, { name, email, phone, whatsapp, password }) {
    let fields = [];
    let values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (whatsapp !== undefined) { fields.push('whatsapp = ?'); values.push(whatsapp); }
    
    if (password !== undefined && password !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      fields.push('password = ?');
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return { changes: 0 };
    }

    const stmt = db.prepare(`UPDATE resellers SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values, id);
    return { changes: result.changes };
  }
}