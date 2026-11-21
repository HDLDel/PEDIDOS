import 'dotenv/config'; // Garante que as variáveis de ambiente sejam carregadas
import bcrypt from 'bcryptjs'; // Necessário para o hashing da senha
import db from './db.js'; // Conexão com o banco de dados
import { AdminModel } from './models/AdminModel.js'; // O modelo do administrador

const newAdminUsername = process.env.ADMIN_USERNAME || ''; // Definido via variavel de ambiente
const newAdminPassword = process.env.ADMIN_PASSWORD || '';
const newAdminName = 'CYBER';
const newAdminEmail = process.env.ADMIN_EMAIL || '';
const newAdminPhone = process.env.ADMIN_PHONE || '';

console.log(`🚀 Tentando adicionar novo administrador: ${newAdminUsername}...`);

try {
    const existingAdmin = AdminModel.getByUsername(newAdminUsername);
    if (existingAdmin) {
        console.log(`🔄 Administrador '${newAdminUsername}' já existe. Atualizando credenciais...`);
        const hashedPassword = bcrypt.hashSync(newAdminPassword, 10);
        db.prepare(`
            UPDATE admins 
            SET password = ?, name = ?, email = ?, phone = ? 
            WHERE username = ?
        `).run(hashedPassword, newAdminName, newAdminEmail, newAdminPhone, newAdminUsername);
        console.log(`✅ Credenciais de '${newAdminUsername}' resetadas com sucesso!`);
    } else {
        AdminModel.create({
            username: newAdminUsername,
            password: newAdminPassword,
            name: newAdminName,
            email: newAdminEmail,
            phone: newAdminPhone
        });
        console.log(`✅ Administrador '${newAdminUsername}' criado com sucesso!`);
    }
} catch (error) {
    console.error(`❌ Erro ao adicionar administrador '${newAdminUsername}':`, error.message);
} finally {
    db.close(); // É importante fechar a conexão com o banco de dados
    console.log('Conexão com o banco de dados fechada.');
}