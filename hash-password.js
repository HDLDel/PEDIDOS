#!/usr/bin/env node
/**
 * Utilitário para gerar hash bcrypt de uma senha.
 * 
 * Uso: node hash-password.js "minha_senha"
 * 
 * Saída: <HASH_BCRYPT>
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
    console.error('Uso: node hash-password.js "minha_senha"');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
