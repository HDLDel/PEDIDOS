import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'vod.sqlite');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS resellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reseller_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('series', 'movie', 'error')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    action TEXT NOT NULL DEFAULT 'Adicionar ao catálogo',
    season TEXT,
    episode TEXT,
    audio_preference TEXT,
    request_type TEXT NOT NULL DEFAULT 'content',
    description TEXT,
    rejection_reason TEXT,
    date TEXT,
    time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tmdb_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL UNIQUE,
    tmdb_id INTEGER,
    title TEXT,
    original_title TEXT,
    year INTEGER,
    poster_path TEXT,
    backdrop_path TEXT,
    overview TEXT,
    vote_average REAL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type);
  CREATE INDEX IF NOT EXISTS idx_requests_reseller ON requests(reseller_id);
`);

// --- SISTEMA DE MIGRAÇÕES SEGURAS (WORLD CLASS) ---
// Função para adicionar colunas apenas se elas não existirem, sem quebrar o banco
const safeAddColumn = (table, column, type) => {
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
        console.log(`✅ Migração: Coluna [${column}] adicionada em [${table}].`);
    } catch (e) {
        // Se der erro é porque a coluna já existe, então ignoramos silenciosamente
    }
};

safeAddColumn('requests', 'rejection_reason', 'TEXT');
safeAddColumn('resellers', 'password', 'TEXT');
safeAddColumn('requests', 'audio_preference', 'TEXT');
safeAddColumn('admins', 'email', 'TEXT');
safeAddColumn('admins', 'phone', 'TEXT');

console.log('✅ Banco SQLite conectado em:', dbPath);

export default db;
