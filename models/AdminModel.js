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

    try {
      // Tenta comparar como Bcrypt (Novo padrão)
      if (bcrypt.compareSync(password, admin.password)) return admin;
    } catch (e) {
      // Se falhar, tenta comparar como texto puro (Padrão antigo)
      if (password === admin.password) return admin;
    }
    return null;
  }

  static getByUsername(username) {
    return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  }
}