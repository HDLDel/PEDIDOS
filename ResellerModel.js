import db from '../db.js';
import bcrypt from 'bcryptjs';

export const ResellerModel = {
    create: ({ name, email, whatsapp, password, phone }) => {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const stmt = db.prepare('INSERT INTO resellers (name, email, whatsapp, password, phone) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(name, email, whatsapp, hashedPassword, phone);
        return { id: result.lastInsertRowid, name, email, whatsapp, phone };
    },

    authenticate: (email, password) => {
        const reseller = db.prepare('SELECT * FROM resellers WHERE email = ?').get(email);
        if (reseller && bcrypt.compareSync(password, reseller.password)) {
            return reseller;
        }
        return null;
    },

    getAll: () => {
        return db.prepare('SELECT id, name, email, whatsapp, phone FROM resellers').all();
    },

    getById: (id) => {
        return db.prepare('SELECT id, name, email, whatsapp, phone FROM resellers WHERE id = ?').get(id);
    },

    update: (id, { name, email, phone, whatsapp, password }) => {
        let fields = [];
        let values = [];

        if (name !== undefined) { fields.push('name = ?'); values.push(name); }
        if (email !== undefined) { fields.push('email = ?'); values.push(email); }
        if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
        if (whatsapp !== undefined) { fields.push('whatsapp = ?'); values.push(whatsapp); }
        if (password !== undefined) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            fields.push('password = ?');
            values.push(hashedPassword);
        }

        if (fields.length === 0) {
            return { changes: 0 }; // No fields to update
        }

        const stmt = db.prepare(`UPDATE resellers SET ${fields.join(', ')} WHERE id = ?`);
        const result = stmt.run(...values, id);
        return { changes: result.changes };
    }
};