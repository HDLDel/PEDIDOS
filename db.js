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
    name TEXT
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

// Migrações: Garante que colunas novas existam em bancos de dados antigos
try {
    db.prepare("ALTER TABLE requests ADD COLUMN rejection_reason TEXT").run();
    console.log('✅ Migração: Coluna rejection_reason verificada/adicionada em requests.');
} catch (e) {
    // A coluna provavelmente já existe
}

try {
    db.prepare("ALTER TABLE resellers ADD COLUMN password TEXT").run();
    console.log('✅ Migração: Coluna password verificada/adicionada em resellers.');
} catch (e) {
    // A coluna provavelmente já existe
}

console.log('✅ Banco SQLite conectado em:', dbPath);

export default db;
