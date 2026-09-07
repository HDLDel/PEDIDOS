-- Tabela onde o PEDIDOS VOD armazena as chaves do BotBot (SQLite / better-sqlite3).
-- Criada em db.js.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Chaves do BotBot gravadas nesta tabela:
--   key = 'BOTBOT_APP_KEY'  | value = Identificador do Bot
--   key = 'BOTBOT_AUTH_KEY' | value = Token de autorização

-- Leitura:
--   SELECT value FROM settings WHERE key = 'BOTBOT_APP_KEY';
--   SELECT value FROM settings WHERE key = 'BOTBOT_AUTH_KEY';

-- Gravação (UPSERT):
INSERT INTO settings (key, value) VALUES ('BOTBOT_APP_KEY', 'sua_app_key')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

INSERT INTO settings (key, value) VALUES ('BOTBOT_AUTH_KEY', 'seu_auth_key')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;