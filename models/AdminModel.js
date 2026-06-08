import db from '../db.js';
import bcrypt from 'bcryptjs';

export class AdminModel {
  static create({ username, password, name, email, phone }) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO admins (username, password, name, email, phone)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(username, hashedPassword, name, email, phone);
  }

  static authenticate(login, password) {
    // Busca por username OU email para maior flexibilidade
    const admin = db.prepare('SELECT * FROM admins WHERE username = ? OR email = ?')
                    .get(login, login);
    
    if (!admin) return null;

    return bcrypt.compareSync(password, admin.password) ? admin : null;
  }

  static getByUsername(username) {
    return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  }
}