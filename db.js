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

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS m3u_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('movie', 'series')),
    normalized_title TEXT NOT NULL,
    logo_hash TEXT,
    year INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_m3u_normalized ON m3u_contents(normalized_title);

  CREATE TABLE IF NOT EXISTS m3u_episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_normalized TEXT NOT NULL,
    series_title TEXT NOT NULL,
    episode_label TEXT NOT NULL,
    season INTEGER,
    episode INTEGER,
    logo_hash TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_m3u_episodes_norm ON m3u_episodes(series_normalized);

  CREATE TABLE IF NOT EXISTS rejection_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    template TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );
`);

// --- SEED DE BOTÕES DE REJEIÇÃO PADRÃO ---
try {
    const checkEmpty = db.prepare('SELECT COUNT(*) as count FROM rejection_reasons').get();
    if (checkEmpty && checkEmpty.count === 0) {
        console.log('🌱 Inicializando botões de rejeição padrão no banco...');
        const insertStmt = db.prepare('INSERT INTO rejection_reasons (title, template, sort_order) VALUES (?, ?, ?)');
        const defaultReasons = [
            { title: 'REPETIDO', template: 'Pedido Repetido.\n\nFavor não repetir os pedidos para não congestionar a fila.', sort_order: 1 },
            { title: 'ANTIGO (Filmes)', template: `Informamos que, por critérios de qualidade técnica e de padronização do acervo, FILMES produzidos antes do ano de 2000 têm baixíssima ou zero prioridade na fila de adição.\n\nFilmes anteriores a 1980 serão rejeitados.\n\nEssa medida se faz necessária devido a limitações relacionadas à disponibilidade da mídia, resolução de imagem, formatos e compatibilidade com os padrões atuais de reprodução, garantindo assim uma melhor experiência ao público.\n\nAgradecemos a compreensão.`, sort_order: 2 },
            { title: 'ANTIGO (Séries)', template: `Informamos que, por critérios de qualidade técnica e de padronização do acervo, SÉRIES produzidas antes do ano de 2000 têm baixíssima ou zero prioridade na fila de adição.\n\nSéries muito antigas serão rejeitadas.\n\nEssa medida se faz necessária devido a limitações relacionadas à disponibilidade da mídia, resolução de imagem, formatos e compatibilidade com os padrões atuais de reprodução, garantindo assim uma melhor experiência ao público.\n\nAgradecemos a compreensão.`, sort_order: 3 },
            { title: 'INDISPONÍVEL', template: 'Conteúdo Indisponível dublado ou legendado.', sort_order: 4 },
            { title: 'ERRO', template: `Poderia fornecer detalhes adicionais sobre o erro?\n\nPreciso identificar a obra (filme ou série), o número do episódio e o momento exato da falha.\n\nPor exemplo: 'No filme X ou no episódio Y da 1ª temporada, ocorre um erro a partir dos 10:30'.\n\nAlém disso, descreva o que aparece na tela (código de erro, travamento ou tela preta).`, sort_order: 5 },
            { title: 'JÁ CONSTA', template: `*Já Consta no Servidor.*\n\nFavor pesquisar nas categorias *All* ou todas as categorias individuais antes de solicitar os conteúdos.\n\nOs pedidos seguem uma ordem que vai da fila de chegada a data de lançamento e disponibilidade, isso pode variar, então não podemos dar prazos para a inserção do conteúdo na grade.\n\nSempre que um Revendedor faz um pedido sem consultar a grade de conteúdos antes ele congestiona ainda mais a fila de pedidos com conteúdos que já estão na grade, atrasando ainda mais os pedidos.\n\nPor isso ressaltamos sempre:\n*Pesquisar nas categorias All ou todas as categorias individuais antes de solicitar os conteúdos.*`, sort_order: 6 },
            { title: 'EXTERNO', template: `Erro de reprodução normalmente é codec do aplicativo em versões muito antigas.\n\nComo Configurar o VLC PLAYER EXTERNO:\n\nVá para Configurações do aplicativo (Settings) onde tem um simbolo de engrenagem.\n\nProcure por "Player" ou "Player Padrão", "Jogador externo" ou "Leitor externo".\n\nSelecione "VLC" ou "Player Externo".\n\nSalve as configurações.\n\nQuando abrir um canal ou filme ou serie, escolha "VLC" na lista de apps.\n\nMarque "Sempre" para definir como padrão.\n\nSe não tiver instalado o VLC a playstore vai se abrir.\n\nInstale o VLC Media Player da Play Store.\n\nTente abrir um canal ou filme ou serie, escolha "VLC" na lista de apps.`, sort_order: 7 },
            { title: 'RECENTE', template: 'Filme lançado recentemente no Cinema.\n\nSomente disponível em 1080 FullHD depois de 3 a 5 meses ao sair nos Streamings.\n\nFavor aguardar, o conteúdo será atualizado automaticamente.', sort_order: 8 },
            { title: 'DUBLADO', template: `*🚨 Pedido Rejeitado — Motivo: Conteúdo Incompleto / Sem Dublagem Integral*\n\nInfelizmente, este conteúdo não existe totalmente dublado em português. A dublagem oficial foi realizada apenas até uma parte da obra e, após isso, a exibição no Brasil foi interrompida (geralmente por baixa audiência na TV ou falta de retorno financeiro), deixando o restante dos episódios sem tradução na nossa língua.\n\nEsse problema é muito comum em novelas turcas, mexicanas, doramas e séries/filmes asiáticos pelos seguintes motivos:\n\n*Formato longo e extenso:* Muitas dessas produções estrangeiras (espiritualmente novelas diárias) possuem centenas de episódios. O processo de dublagem profissional é extremamente caro e demorado, exigindo um investimento que as distribuidoras muitas vezes não conseguem pagar por inteiro.\n\n*Abandono de transmissão:* Quando uma emissora ou plataforma de streaming traz uma produção de nicho para o Brasil e o público não corresponde ao esperado, o projeto é cancelado no meio do caminho para evitar prejuízos.\n\n*Lançamento internacional lento:* Por conta do volume massivo de capítulos, o mercado global prioriza o lançamento de versões apenas legendadas para manter a transmissão ágil. A dublagem, quando acontece, é feita a passos muito lentos por distribuidoras locais.\n\n*Resumo:* O restante dos episódios só está disponível no idioma original com legendas. Como o nosso catálogo foca em conteúdos completos/dublados conforme solicitado, o pedido não poderá ser atendido.\n\nSem detalhes adicionais. Agradecemos a compreensão.`, sort_order: 9 }
        ];
        db.transaction(() => {
            for (const r of defaultReasons) {
                insertStmt.run(r.title, r.template, r.sort_order);
            }
        })();
        console.log('✅ Botões de rejeição padrão inseridos com sucesso!');
    }
} catch (err) {
    console.error('❌ Erro ao rodar seed dos botões de rejeição:', err.message);
}

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
safeAddColumn('m3u_contents', 'logo_hash', 'TEXT');
safeAddColumn('m3u_contents', 'year', 'INTEGER');
safeAddColumn('m3u_contents', 'logo_url', 'TEXT');
safeAddColumn('m3u_episodes', 'logo_url', 'TEXT');

// Garantir índice do logo_hash na tabela m3u_contents
try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_m3u_logo_hash ON m3u_contents(logo_hash);');
} catch (e) {
    // ignorar
}

console.log('✅ Banco SQLite conectado em:', dbPath);

export default db;
