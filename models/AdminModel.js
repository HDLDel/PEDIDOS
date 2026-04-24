import db from '../db.js';

export class AdminModel {
  static create({ username, password, name }) {
    const stmt = db.prepare(`
      INSERT INTO admins (username, password, name)
      VALUES (?, ?, ?)
    `);
    return stmt.run(username, password, name);
  }

  static authenticate(username, password) {
    return db.prepare('SELECT * FROM admins WHERE username = ? AND password = ?')
             .get(username, password);
  }
}