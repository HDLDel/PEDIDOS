import db from '../db.js';
import bcrypt from 'bcryptjs';

const BCRYPT_HASH_REGEX = /^\$2[ayb]\$.*/;

function hashPassword(password) {
  // Se já for um hash bcrypt válido, usa como está (evita double-hash)
  if (BCRYPT_HASH_REGEX.test(password)) return password;
  return bcrypt.hashSync(password, 10);
}

export class AdminModel {
  static create({ username, password, name, email, phone }) {
    const hashedPassword = hashPassword(password);
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