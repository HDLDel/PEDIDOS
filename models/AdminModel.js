import db from '../db.js';
import bcrypt from 'bcryptjs';

export class AdminModel {
  static create({ username, password, name }) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO admins (username, password, name)
      VALUES (?, ?, ?)
    `);
    return stmt.run(username, hashedPassword, name);
  }

  static authenticate(username, password) {
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    
    if (admin && bcrypt.compareSync(password, admin.password)) {
      return admin;
    }
    return null;
  }

  static getByUsername(username) {
    return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  }
}