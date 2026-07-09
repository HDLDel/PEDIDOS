import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import db from './db.js';
import session from 'express-session';
import { RequestModel } from './models/RequestModel.js';
import { ResellerModel } from './models/ResellerModel.js';
import { TmdbModel } from './models/TmdbModel.js';
import { AdminModel } from './models/AdminModel.js';
import { WhatsAppService } from './WhatsAppService.js';
import { BotBotService } from './BotBotService.js';
import { M3uModel } from './models/M3uModel.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Trava global para reenvio em massa
let isResendingBackground = false;

// --- SISTEMA DE LOCK (MANUTENÇÃO) ---
const getLock = () => {
    const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'LOCK_ENABLED'").get();
    const msgRow = db.prepare("SELECT value FROM settings WHERE key = 'LOCK_MESSAGE'").get();
    return {
        enabled: enabledRow ? enabledRow.value === 'true' : false,
        message: msgRow ? msgRow.value : 'Sistema em manutenção. Tente novamente mais tarde.'
    };
};
const setLock = (enabled, message) => {
    db.prepare(`INSERT INTO settings (key, value) VALUES ('LOCK_ENABLED', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(enabled ? 'true' : 'false');
    db.prepare(`INSERT INTO settings (key, value) VALUES ('LOCK_MESSAGE', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(message);
};

// --- PROTEÇÃO CONTRA QUEDAS (WORLD CLASS SAFETY) ---
// Impede que erros de arquivos bloqueados (EBUSY) ou falhas em bibliotecas matem o servidor
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Rejeição não tratada (capturada):', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Erro crítico no processo (capturado):', err.message);
    if (err.code === 'EBUSY') {
        console.log('ℹ️ [Windows Lock] Um arquivo de sessão está em uso. O servidor continuará ativo e tentará recuperar o acesso na próxima inicialização do WhatsApp.');
    }
    if (err.message.includes('Execution context was destroyed')) {
        console.log('ℹ️ Nota: O navegador fechou inesperadamente. O sistema de recuperação foi ativado.');
    }
});

// Configurações do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração da sessão
app.use(session({
    secret: process.env.SESSION_SECRET || (function () { throw new Error('ERRO: SESSION_SECRET não configurado no .env'); })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true apenas com HTTPS
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 dia
    }
}));

app.set('view engine', 'ejs');

// Define os caminhos de forma absoluta para evitar erros de diretório
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.static(path.join(process.cwd(), 'public')));

// Verificar e criar admin padrão se não existir
const adminUsername = process.env.ADMIN_USERNAME;
if (adminUsername && !AdminModel.getByUsername(adminUsername)) {
    console.log(`🌱 Criando usuário administrador padrão: ${adminUsername}...`);
    AdminModel.create({
        username: adminUsername,
        password: process.env.ADMIN_PASSWORD,
        name: process.env.ADMIN_NAME
    });
}

// Executar seed de revendedores e pedidos se o banco estiver vazio
const countResellers = db.prepare('SELECT COUNT(*) as count FROM resellers').get();
if (countResellers.count === 0) {
    console.log('🌱 Banco de revendedores vazio. Executando seed de dados de teste...');
    try {
        // Importar e executar seed dinamicamente
        const { execSync } = await import('child_process');
        execSync('node seed.js', { stdio: 'inherit', cwd: process.cwd() });
    } catch (e) {
        console.error('❌ Erro no seed:', e.message);
    }
}

// --- AUTO-MIGRAÇÃO INTELIGENTE DE SENHAS ---
const migrateTable = (tableName) => {
    const records = db.prepare(`SELECT id, password FROM ${tableName}`).all();
    let migratedCount = 0;

    records.forEach(record => {
        const pwd = record.password || '<SENHA>';
        // Verifica se a senha já possui o prefixo de um hash Bcrypt válido
        const isAlreadyHashed = /^\$2[ayb]\$.*/.test(pwd);

        if (!isAlreadyHashed) {
            const hash = bcrypt.hashSync(pwd, 10);
            db.prepare(`UPDATE ${tableName} SET password = ? WHERE id = ?`).run(hash, record.id);
            migratedCount++;
        }
    });
    return migratedCount;
};

const migratedAdmins = migrateTable('admins');
const migratedResellers = migrateTable('resellers');

if (migratedAdmins > 0 || migratedResellers > 0) {
    console.log(`🔒 Segurança: ${migratedAdmins + migratedResellers} senhas legadas migradas com sucesso.`);
}

// --- SEGURANÇA ADMIN ---
const checkAdminAuth = (req, res, next) => {
    // Em uma aplicação real, você verificaria req.session.adminId
    // Por enquanto, mantemos a simulação para não quebrar o fluxo atual
    if (req.session.adminId) return next();
    res.redirect('/admin/login');
};

app.get('/admin/login', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/dashboard');
    res.render('admin/login');
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const admin = AdminModel.authenticate(username, password); // Supondo que AdminModel.authenticate existe
    if (admin) { // Se a autenticação for bem-sucedida
        req.session.adminId = admin.id; // Armazena o ID do admin na sessão
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { error: 'Acesso negado: Credenciais inválidas.' });
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin/dashboard');
        }
        res.clearCookie('connect.sid'); // Limpa o cookie da sessão
        res.redirect('/admin/login');
    });
});

app.get('/', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/dashboard');
    if (req.session.resellerId) return res.redirect('/revenda/dashboard');
    res.redirect('/revenda/login');
});

app.get('/admin/dashboard', checkAdminAuth, (req, res) => {
    let requests = RequestModel.getAll();
    const stats = RequestModel.getStats();

    // Carregar dados da playlist M3U (títulos e hashes de imagem) para comparação
    const { titleMap: m3uTitles, logoSet: m3uLogos } = M3uModel.getM3uData();
    const hasM3uData = m3uTitles.size > 0 || m3uLogos.size > 0;

    // Helper para extrair o ano de 4 dígitos de um valor de data/ano (ex: "15/04/2012" -> 2012)
    const get4DigitYear = (yearVal) => {
        if (!yearVal) return null;
        const match = yearVal.toString().match(/\b(19\d{2}|20\d{2})\b/);
        return match ? parseInt(match[1], 10) : null;
    };

    const checkInM3u = (item) => {
        if (item.requestType === 'error') return []; // Erros não devem ser checados na M3U

        const results = [];

        // Extrair o hash da imagem do pedido, se existir
        let reqLogoHash = null;
        if (item.poster) {
            const posterUrl = item.poster;
            const slashIndex = posterUrl.lastIndexOf('/');
            if (slashIndex !== -1) {
                const hash = posterUrl.substring(slashIndex + 1).trim().toLowerCase();
                if (hash && !hash.includes('placeholder')) {
                    reqLogoHash = hash;
                }
            }
        }

        // 1. Tentar correspondência por Pôster/Banner do TMDB (100% de precisão, evita homônimos de tipos diferentes)
        if (reqLogoHash && m3uLogos.has(reqLogoHash)) {
            const matches = db.prepare('SELECT title, normalized_title, logo_url FROM m3u_contents WHERE logo_hash = ?').all(reqLogoHash);
            for (const m of matches) {
                results.push({ title: m.title, normalizedTitle: m.normalized_title, logoUrl: m.logo_url, logoHash: reqLogoHash });
            }
        }

        // 2. Tentar correspondência estrita por Título, Tipo e Ano
        const matchTitles = [
            item.title,
            item.tmdbTitle,
            item.tmdbOriginalTitle
        ].filter(Boolean);

        const reqYear = get4DigitYear(item.year);

        for (const title of matchTitles) {
            const cleanTitle = M3uModel.cleanSeriesName(title);
            const norm = M3uModel.normalizeTitle(cleanTitle);
            const key = `${item.type}:${norm}`;
            
            if (m3uTitles.has(key)) {
                const entries = m3uTitles.get(key) || [];

                if (reqYear) {
                    // 1. Tenta correspondência exata de ano
                    const yearMatches = entries.filter(e => e.year === reqYear);
                    // 2. Se não achou com ano exato, mas há entradas sem ano na M3U, aceita como fallback
                    const fallbackMatches = yearMatches.length > 0 ? yearMatches : entries.filter(e => !e.year);
                    for (const e of fallbackMatches) {
                        if (!results.some(r => r.normalizedTitle === e.normalizedTitle && r.title === e.title)) {
                            results.push({ title: e.title, normalizedTitle: e.normalizedTitle, logoUrl: e.logoUrl, logoHash: e.logoHash });
                        }
                    }
                } else {
                    // Sem ano informado no pedido, aceita todas
                    for (const e of entries) {
                        if (!results.some(r => r.normalizedTitle === e.normalizedTitle && r.title === e.title)) {
                            results.push({ title: e.title, normalizedTitle: e.normalizedTitle, logoUrl: e.logoUrl, logoHash: e.logoHash });
                        }
                    }
                }
            }
        }

        return results;
    };

    // LÓGICA DE AGRUPAMENTO MESTRE: Todos do mesmo TMDB ID dividem 1 card
    const groupedMap = new Map();

    requests.forEach(req => {
        const m3uCheck = checkInM3u(req);
        req.inM3u = m3uCheck.length > 0;
        req.m3uTitle = m3uCheck.length > 0 ? m3uCheck[0].title : '';
        req.m3uNormalized = m3uCheck.length > 0 ? m3uCheck[0].normalizedTitle : '';
        req.m3uLogos = m3uCheck.filter(m => m.logoUrl).map(m => ({ logoUrl: m.logoUrl, title: m.title }));
        
        const key = req.tmdb_id ? `tmdb-${req.tmdb_id}` : `manual-${req.type}-${req.title.toLowerCase()}`;

        if (!groupedMap.has(key)) {
            req.subRequests = [];
            groupedMap.set(key, req);
        } else {
            const mainReq = groupedMap.get(key);
            // Se o pedido atual for PENDENTE e o card principal NÃO FOR PENDENTE, o atual assume a capa
            if (req.status === 'pending' && mainReq.status !== 'pending') {
                req.subRequests = mainReq.subRequests || [];
                const { subRequests, ...mainReqCopy } = mainReq;
                req.subRequests.push(mainReqCopy);
                groupedMap.set(key, req);
            } else {
                mainReq.subRequests.push(req);
            }
        }
    });

    const groupedRequests = [...groupedMap.values()];
    groupedRequests.sort((a, b) => a.id - b.id);

    res.render('dashboard', { requests: groupedRequests, stats, hasM3uData });
});

// Rota para Conexão do WhatsApp (Página Dedicada)
app.get('/admin/whatsapp', checkAdminAuth, async (req, res) => {
    // Avisa o servidor motor para iniciar caso não tenha sido iniciado
    await WhatsAppService.initialize();
    res.render('admin/whatsapp');
});

// Rota para Conexão do BotBot
app.get('/admin/botbot', checkAdminAuth, (req, res) => {
    const creds = BotBotService.getCredentials();
    res.render('admin/botbot', { appKey: creds.appKey, authKey: creds.authKey });
});

// Rota para Gestão de Revendedores
app.get('/admin/resellers', checkAdminAuth, (req, res) => {
    const resellers = ResellerModel.getAll();

    // Enriquecer os dados dos revendedores com estatísticas de seus pedidos
    const resellersWithStats = resellers.map(r => {
        const requests = RequestModel.getByReseller(r.id);
        return {
            ...r,
            totalRequests: requests.length,
            pendingRequests: requests.filter(req => req.status === 'pending').length
        };
    });

    const stats = RequestModel.getStats();
    res.render('admin/resellers', { resellers: resellersWithStats, stats });
});

// --- ROTAS DO PORTAL DO REVENDE-DOR ---
const checkResellerAuth = (req, res, next) => {
    const lock = getLock();
    if (lock.enabled) {
        if (req.session.resellerId) req.session.destroy(() => {});
        return res.redirect('/revenda/login?lock=1');
    }
    if (req.session.resellerId) {
        return next();
    }
    res.redirect('/revenda/login');
};

// Dashboard do Revendedor
app.get('/revenda/dashboard', checkResellerAuth, (req, res) => {
    const resellerId = req.session.resellerId;
    const reseller = ResellerModel.getById(resellerId);
    if (!reseller) {
        req.session.destroy(() => res.redirect('/revenda/login'));
        return;
    }
    const requests = RequestModel.getByReseller(resellerId);
    const stats = {
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length
    };

    // M3U data for Presentes na M3U badge
    const { titleMap: m3uTitles, logoSet: m3uLogos } = M3uModel.getM3uData();
    const hasM3uData = m3uTitles.size > 0 || m3uLogos.size > 0;

    const get4DigitYear = (yearVal) => {
        if (!yearVal) return null;
        const match = yearVal.toString().match(/\b(19\d{2}|20\d{2})\b/);
        return match ? parseInt(match[1], 10) : null;
    };

    const checkInM3u = (item) => {
        if (item.requestType === 'error') return [];

        const results = [];

        let reqLogoHash = null;
        if (item.poster) {
            const posterUrl = item.poster;
            const slashIndex = posterUrl.lastIndexOf('/');
            if (slashIndex !== -1) {
                const hash = posterUrl.substring(slashIndex + 1).trim().toLowerCase();
                if (hash && !hash.includes('placeholder')) {
                    reqLogoHash = hash;
                }
            }
        }

        if (reqLogoHash && m3uLogos.has(reqLogoHash)) {
            const matches = db.prepare('SELECT title, normalized_title, logo_url FROM m3u_contents WHERE logo_hash = ?').all(reqLogoHash);
            for (const m of matches) {
                results.push({ title: m.title, normalizedTitle: m.normalized_title, logoUrl: m.logo_url, logoHash: reqLogoHash });
            }
        }

        const matchTitles = [
            item.title,
            item.tmdbTitle,
            item.tmdbOriginalTitle
        ].filter(Boolean);

        const reqYear = get4DigitYear(item.year);

        for (const title of matchTitles) {
            const cleanTitle = M3uModel.cleanSeriesName(title);
            const norm = M3uModel.normalizeTitle(cleanTitle);
            const key = `${item.type}:${norm}`;

            if (m3uTitles.has(key)) {
                const entries = m3uTitles.get(key) || [];

                if (reqYear) {
                    const yearMatches = entries.filter(e => e.year === reqYear);
                    const fallbackMatches = yearMatches.length > 0 ? yearMatches : entries.filter(e => !e.year);
                    for (const e of fallbackMatches) {
                        if (!results.some(r => r.normalizedTitle === e.normalizedTitle && r.title === e.title)) {
                            results.push({ title: e.title, normalizedTitle: e.normalizedTitle, logoUrl: e.logoUrl, logoHash: e.logoHash });
                        }
                    }
                } else {
                    for (const e of entries) {
                        if (!results.some(r => r.normalizedTitle === e.normalizedTitle && r.title === e.title)) {
                            results.push({ title: e.title, normalizedTitle: e.normalizedTitle, logoUrl: e.logoUrl, logoHash: e.logoHash });
                        }
                    }
                }
            }
        }

        return results;
    };

    requests.forEach(req => {
        const m3uCheck = checkInM3u(req);
        req.inM3u = m3uCheck.length > 0;
        req.m3uTitle = m3uCheck.length > 0 ? m3uCheck[0].title : '';
        req.m3uNormalized = m3uCheck.length > 0 ? m3uCheck[0].normalizedTitle : '';
        req.m3uLogos = m3uCheck.filter(m => m.logoUrl).map(m => ({ logoUrl: m.logoUrl, title: m.title }));
    });

    res.render('revenda/dashboard', { reseller, requests, stats, hasM3uData, error: req.query.error });
});

// API para o revendedor responder/explicar um pedido rejeitado ou pendente com histórico de auditoria
app.post('/api/requests/:id/respond', checkResellerAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { explanation } = req.body;
    
    // Obter o pedido
    const request = RequestModel.getById(id);
    if (!request) return res.status(404).json({ error: 'Pedido não encontrado' });

    // Validar limite de contestações (Máximo: 2)
    let replyCount = 0;
    if (request.description) {
        replyCount = (request.description.match(/\[Resposta do Revendedor/g) || []).length;
    }
    if (replyCount >= 2) {
        return res.status(403).json({ error: 'Você já atingiu o limite de contestações para este pedido (Máximo: 2).' });
    }
    
    // Validar se o pedido pertence ao revendedor autenticado
    if (request.reseller_id !== req.session.resellerId) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Captura o motivo da rejeição anterior se existir para o histórico de auditoria
    let rejectionPrefix = '';
    if (request.rejectionReason) {
        rejectionPrefix = `[Rejeitado pelo Admin - Motivo: ${request.rejectionReason}]`;
    }
    
    // Montar nova descrição contendo o histórico de auditoria e a resposta do revendedor
    let newDescription = '';
    const timestamp = `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
    
    if (request.description) {
        newDescription = request.description;
        if (rejectionPrefix) {
            newDescription += `\n\n${rejectionPrefix}`;
        }
        newDescription += `\n[Resposta do Revendedor em ${timestamp}]:\n${explanation}`;
    } else {
        newDescription = rejectionPrefix ? `${rejectionPrefix}\n` : '';
        newDescription += `[Resposta do Revendedor em ${timestamp}]:\n${explanation}`;
    }
    
    try {
        // Atualizar descrição no banco
        RequestModel.update(id, { description: newDescription });
        // Mudar status de volta para pendente e limpar o motivo de rejeição principal
        RequestModel.updateStatus(id, 'pending', null);
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API para o revendedor excluir seu próprio pedido pendente
app.delete('/api/requests/revenda/:id', checkResellerAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const resellerId = req.session.resellerId;

    try {
        const request = RequestModel.getById(id);
        if (!request) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        // Validação de propriedade: o pedido precisa pertencer ao revendedor
        if (request.reseller_id !== resellerId) {
            return res.status(403).json({ error: 'Acesso negado: Este pedido não pertence a você.' });
        }

        // Validação de status: somente pedidos pendentes podem ser excluídos
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Apenas pedidos pendentes podem ser excluídos.' });
        }

        RequestModel.delete(id);
        res.json({ success: true, message: 'Pedido excluído com sucesso.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Telas de Solicitação
app.get('/revenda/solicitar', checkResellerAuth, (req, res) => {
    const resellerId = req.session.resellerId;
    const reseller = ResellerModel.getById(resellerId);
    const requests = RequestModel.getByReseller(resellerId);
    // Não passamos mais a API KEY para o frontend
    res.render('revenda/solicitar', { reseller, requests });
});
app.get('/revenda/solicitar/filme', checkResellerAuth, (req, res) => res.render('revenda/buscar-filme'));

// Login e Registro
app.get('/revenda/login', (req, res) => {
    const lock = getLock();
    if (req.session.resellerId) return res.redirect('/revenda/dashboard');
    if (lock.enabled) {
        return res.render('revenda/login', { lock: lock.message });
    }
    res.render('revenda/login');
});

app.post('/revenda/login', (req, res) => {
    const lock = getLock();
    if (lock.enabled) {
        return res.render('revenda/login', { lock: lock.message, error: 'Sistema em manutenção. Login bloqueado.' });
    }
    const { email, password } = req.body;
    const reseller = ResellerModel.authenticate(email, password);
    if (reseller) {
        req.session.resellerId = reseller.id;
        res.redirect('/revenda/dashboard');
    } else {
        res.render('revenda/login', { error: 'E-mail ou senha incorretos.' });
    }
});

app.get('/revenda/register', (req, res) => res.render('revenda/register'));

app.post('/revenda/register', (req, res) => {
    const { name, email, whatsapp, password, phone } = req.body;
    try {
        ResellerModel.create({ name, email, whatsapp, password, phone });
        res.redirect('/revenda/login');
    } catch (e) {
        res.status(400).send("Erro ao cadastrar: " + e.message);
    }
});

app.get('/revenda/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.redirect('/revenda/dashboard');
        res.clearCookie('connect.sid');
        res.redirect('/revenda/login');
    });
});

// --- API ---

// API - Estatísticas
app.get('/api/stats', checkAdminAuth, (req, res) => {
    res.json(RequestModel.getStats());
});

// API - Listar todos os pedidos
app.get('/api/requests', checkAdminAuth, (req, res) => {
    const { status, category, search } = req.query;
    let requests;

    if (search) {
        requests = RequestModel.search(search);
    } else if (status && status !== 'all') {
        requests = RequestModel.getByStatus(status);
    } else if (category && category !== 'all') {
        requests = RequestModel.getByCategory(category);
    } else {
        requests = RequestModel.getAll();
    }

    res.json(requests);
});

// API - Obter pedido por ID
app.get('/api/requests/:id', checkAdminAuth, (req, res) => {
    const request = RequestModel.getById(parseInt(req.params.id));
    if (!request) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(request);
});

// API - Atualizar status (aprovar/rejeitar)
app.post('/api/requests/:id/status', checkAdminAuth, (req, res) => {
    const { status, rejectionReason } = req.body;
    const syncAll = req.body.syncAll !== false; // Padrão é true, só false se declarado
    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }

    const id = parseInt(req.params.id);
    const updated = RequestModel.updateStatus(id, status, rejectionReason);
    if (!updated) return res.status(404).json({ error: 'Pedido não encontrado' });

    // LÓGICA DE BACKUP: Tenta BotBot primeiro, se falhar ou cair, o Local Assume!
    const trySendNotification = async (reqData) => {
        const bbSuccess = await BotBotService.sendStatusNotification(reqData);
        if (!bbSuccess) {
            console.log('⚠️ BotBot indisponível. Acionando Motor WhatsApp Local como backup...');
            WhatsAppService.sendStatusNotification(reqData).catch(e => console.error("Erro Notificação Backup:", e));
        }
    };

    // SINCRONIZAÇÃO: Se for um conteúdo TMDB, atualiza todos os outros revendedores que pediram o mesmo
    if (syncAll) {
        const tmdbData = TmdbModel.getByRequestId(id);
        if (tmdbData && tmdbData.tmdb_id) {
            const siblings = db.prepare(`
                SELECT r.id, res.name as reseller, res.whatsapp, r.title
                FROM requests r
                JOIN resellers res ON r.reseller_id = res.id
                JOIN tmdb_contents t ON r.id = t.request_id
                WHERE t.tmdb_id = ? AND r.status = 'pending' AND r.id != ?
            `).all(tmdbData.tmdb_id, id);

            for (const sibling of siblings) {
                RequestModel.updateStatus(sibling.id, status, rejectionReason);
                trySendNotification({ ...sibling, status, rejectionReason });
            }
        }
    }

    trySendNotification(updated);

    res.json(updated);
});

// API - Criar novo pedido
app.post('/api/requests', (req, res) => {
    let { tmdbId, title, type, action, season, episode, requestType, description, date, time, audioPreference } = req.body;

    let resellerId;

    // Se houver sessão, usa o ID do revendedor logado
    if (req.session.resellerId) {
        resellerId = req.session.resellerId;
    } else {
        return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    // Segurança de integridade: Filmes não podem ter temporada ou episódio
    if (type === 'movie') {
        season = null;
        episode = null;
    }

    // Validação de limite de pedidos pendentes (máximo 10)
    const resellerRequests = RequestModel.getByReseller(resellerId);
    const pendingCount = resellerRequests.filter(r => r.status === 'pending').length;
    if (pendingCount >= 10 && requestType !== 'error') {
        return res.status(403).json({
            error: '⚠️ Limite atingido: Você possui 10 pedidos pendentes. No momento, só é permitido reportar erros.'
        });
    }

    // Validação de Duplicidade: Agora só bloqueia se o PRÓPRIO revendedor já pediu e está pendente
    if (tmdbId) {
        const alreadyRequestedByMe = db.prepare(`
            SELECT r.id FROM requests r
            JOIN tmdb_contents t ON r.id = t.request_id
            WHERE t.tmdb_id = ? AND r.reseller_id = ? AND r.status = 'pending'
        `).get(parseInt(tmdbId), resellerId);

        if (alreadyRequestedByMe) {
            return res.status(409).json({ error: 'Você já possui uma solicitação pendente para este conteúdo.' });
        }
    }

    // Mapeia o tipo de solicitação para um texto legível
    const actionMap = {
        'content': 'Adicionar ao catálogo',
        'season': 'Solicitar nova temporada',
        'episode': 'Solicitar episódios faltando',
        'error': 'Reportar erro de reprodução'
    };
    const finalAction = action || actionMap[requestType] || 'Solicitação';

    const request = RequestModel.create({
        resellerId: resellerId,
        title,
        type,
        action: finalAction,
        season,
        episode,
        requestType,
        description,
        date,
        time,
        audioPreference,
        tmdbId: tmdbId ? parseInt(tmdbId) : null
    });

    // Busca posters e dados do TMDB em segundo plano
    TmdbModel.fetchAndSave(request.id, title, type, tmdbId).catch(e => console.error("Erro TMDB:", e));

    res.status(201).json(request);
});

// API - Revendedores
app.get('/api/resellers', checkAdminAuth, (req, res) => {
    res.json(ResellerModel.getAll());
});

// API para Deletar Revendedor (Somente Admin)
app.delete('/api/resellers/:id', checkAdminAuth, (req, res) => {
    const result = db.prepare('DELETE FROM resellers WHERE id = ?').run(req.params.id);
    res.json({ success: result.changes > 0 });
});

// API para Limpar todos os pedidos de um revendedor
app.delete('/api/resellers/:id/requests', checkAdminAuth, (req, res) => {
    const resellerId = req.params.id;
    // Remove dados do TMDB vinculados aos pedidos do revendedor primeiro
    db.prepare('DELETE FROM tmdb_contents WHERE request_id IN (SELECT id FROM requests WHERE reseller_id = ?)').run(resellerId);
    // Remove os pedidos
    const result = db.prepare('DELETE FROM requests WHERE reseller_id = ?').run(resellerId);
    res.json({ success: true, changes: result.changes });
});

// API para Deletar Pedido Individual (Somente Admin)
app.delete('/api/requests/:id', checkAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const result = RequestModel.delete(id);
        res.json({ success: result.changes > 0 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API para Editar Revendedor
app.put('/api/resellers/:id', checkAdminAuth, (req, res) => {
    const { name, email, phone, whatsapp, password } = req.body;
    const id = req.params.id;
    const result = ResellerModel.update(id, { name, email, phone, whatsapp, password });
    res.json({ success: result.changes > 0 });
});

app.get('/api/resellers/:id', checkAdminAuth, (req, res) => {
    const reseller = ResellerModel.getById(parseInt(req.params.id));
    if (!reseller) return res.status(404).json({ error: 'Revendedor não encontrado' });
    res.json(reseller);
});

// API - Proxy de Busca TMDB (Protege a API KEY)
app.get('/api/tmdb/search', checkResellerAuth, async (req, res) => {
    const { query } = req.query;
    if (!query || query.length < 3) return res.status(400).json({ error: 'Busca inválida' });

    const apiKey = process.env.TMDB_API_KEY;
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=pt-BR`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
});

// API - Status do WhatsApp
app.get('/api/whatsapp/status', checkAdminAuth, async (req, res) => {
    const status = await WhatsAppService.getStatus();
    res.json(status);
});

// API - Status do BotBot
app.get('/api/botbot/status', checkAdminAuth, async (req, res) => {
    const status = await BotBotService.getStatus();
    res.json(status);
});

// API - Obter Configurações do BotBot
app.get('/api/botbot/config', checkAdminAuth, (req, res) => {
    const creds = BotBotService.getCredentials();
    res.json(creds);
});

// API - Configurar BotBot
app.post('/api/botbot/config', checkAdminAuth, (req, res) => {
    const { appKey, authKey } = req.body;
    BotBotService.saveCredentials(appKey, authKey);
    res.json({ success: true, message: 'Chaves salvas com sucesso!' });
});

// API - Testar BotBot enviando mensagem de teste
app.post('/api/botbot/test', checkAdminAuth, async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Telefone obrigatório' });

    const creds = BotBotService.getCredentials();
    if (!creds.appKey || !creds.authKey) {
        return res.json({ success: false, error: 'BotBot não configurado. Configure as chaves primeiro.' });
    }

    try {
        const response = await fetch('https://botbot.chat/api/v2/sendText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'appKey': creds.appKey,
                'authKey': creds.authKey
            },
            body: JSON.stringify({ to: phone, message: 'teste botbot', typingDelay: 1 })
        });

        const data = await response.json();
        if (response.ok) {
            res.json({ success: true, data: data.message || JSON.stringify(data) });
        } else {
            res.json({ success: false, data: data.error || JSON.stringify(data) });
        }
    } catch (e) {
        res.json({ success: false, error: 'Falha de conexão com BotBot: ' + e.message });
    }
});

// API - Lock (Manutenção)
app.get('/api/lock', (req, res) => {
    const lock = getLock();
    res.json(lock);
});

app.post('/api/lock', checkAdminAuth, (req, res) => {
    const { enabled, message } = req.body;
    setLock(!!enabled, message || '');
    res.json({ success: true });
});

// API - Reenviar todas as notificações em massa
app.post('/api/notifications/resend-all', checkAdminAuth, async (req, res) => {
    if (isResendingBackground) {
        return res.status(429).json({ message: '❌ Um reenvio em lote já está em andamento. Aguarde a finalização do processo atual antes de iniciar outro.' });
    }

    const requests = RequestModel.getAll().filter(r => r.status !== 'pending').slice(0, 50);

    isResendingBackground = true;

    const trySendNotification = async (reqData) => {
        const bbSuccess = await BotBotService.sendStatusNotification(reqData);
        if (!bbSuccess) {
            WhatsAppService.sendStatusNotification(reqData).catch(e => console.error("Erro Notificação Backup:", e));
        }
    };

    setTimeout(async () => {
        console.log(`🚀 Iniciando reenvio em lote de ${requests.length} notificações...`);
        for (const r of requests) {
            await trySendNotification(r);
            await new Promise(resolve => setTimeout(resolve, 36000));
        }
        console.log(`✅ Reenvio em lote finalizado!`);
        isResendingBackground = false;
    }, 0);

    res.json({ success: true, message: `Reenvio em lote iniciado para ${requests.length} pedidos. Isso acontecerá em segundo plano (aguarde uns minutos).` });
});

// API - Iniciar/Conectar WhatsApp
app.post('/api/whatsapp/start', checkAdminAuth, async (req, res) => {
    await WhatsAppService.initialize();
    res.json({ success: true, message: 'Iniciando navegador...' });
});

// API - Resetar WhatsApp
app.post('/api/whatsapp/reset', checkAdminAuth, async (req, res) => {
    await WhatsAppService.logout();
    res.json({ success: true });
});

// API - TMDB
app.get('/api/tmdb/:requestId', checkAdminAuth, (req, res) => {
    const tmdbData = TmdbModel.getByRequestId(parseInt(req.params.requestId));
    if (!tmdbData) return res.status(404).json({ error: 'Dados TMDB não encontrados' });
    res.json(tmdbData);
});

// API - Obter status do sincronismo M3U
app.get('/api/m3u/status', checkAdminAuth, (req, res) => {
    try {
        const source = M3uModel.getSetting('M3U_SOURCE', 'exemplo.m3u');
        const lastSync = M3uModel.getSetting('M3U_LAST_SYNC', 'Nunca sincronizado');
        const statsStr = M3uModel.getSetting('M3U_STATS', '{}');
        const stats = JSON.parse(statsStr);
        res.json({ success: true, source, lastSync, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API - Iniciar sincronismo M3U
app.post('/api/m3u/sync', checkAdminAuth, async (req, res) => {
    const { source } = req.body;
    try {
        const stats = await M3uModel.syncM3u(source);
        res.json({ success: true, stats, message: 'Playlist M3U sincronizada com sucesso!' });
    } catch (e) {
        console.error("Erro na sincronização M3U:", e);
        res.status(500).json({ error: e.message });
    }
});

// API - Limpar dados M3U do banco
app.post('/api/m3u/clear', checkAdminAuth, (req, res) => {
    try {
        M3uModel.clearM3u();
        res.json({ success: true, message: 'Dados da M3U limpos com sucesso!' });
    } catch (e) {
        console.error("Erro ao limpar M3U:", e);
        res.status(500).json({ error: e.message });
    }
});

function checkAdminOrReseller(req, res, next) {
    if (req.session.adminId || req.session.resellerId) return next();
    res.status(401).json({ error: 'Não autorizado' });
}

// API - Obter episódios de uma série na M3U
app.get('/api/m3u/episodes', checkAdminOrReseller, (req, res) => {
    try {
        const { normalized } = req.query;
        if (!normalized) return res.json([]);
        const episodes = M3uModel.getEpisodes(normalized);
        res.json(episodes);
    } catch (e) {
        console.error("Erro ao buscar episódios M3U:", e);
        res.status(500).json({ error: e.message });
    }
});

// API - Obter título da M3U para um normalized + type
app.get('/api/m3u/title', checkAdminOrReseller, (req, res) => {
    try {
        const { normalized, type } = req.query;
        if (!normalized) return res.json(null);
        const { titleMap } = M3uModel.getM3uData();
        const key = `${type}:${normalized}`;
        const entries = titleMap.get(key);
        if (entries && entries.length > 0) {
            const logos = entries.filter(e => e.logoUrl).map(e => ({ logoUrl: e.logoUrl, title: e.title }));
            const titles = entries.map(e => ({ title: e.title, year: e.year }));
            res.json({ title: entries[0].title, titles, logoHash: entries[0].logoHash, logoUrl: entries[0].logoUrl, logos });
        } else {
            res.json(null);
        }
    } catch (e) {
        console.error("Erro ao buscar título M3U:", e);
        res.status(500).json({ error: e.message });
    }
});

// API - Proxy de imagens M3U (tvg-logo)
app.get('/api/m3u/logo', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) return res.status(response.status).end();
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (e) {
        res.redirect(url);
    }
});

// --- PALANTIR INTEGRATION PROXY ---

function getPalantirConfig() {
    const url = process.env.PALANTIR_API_URL;
    const token = process.env.PALANTIR_API_TOKEN;
    if (!url || !token) return null;
    return { url: url.replace(/\/+$/, ''), token };
}

app.get('/api/palantir/search', checkAdminAuth, async (req, res) => {
    const pc = getPalantirConfig();
    if (!pc) return res.status(400).json({ error: 'Palantir não configurado. Verifique PALANTIR_API_URL e PALANTIR_API_TOKEN no .env' });
    const { title, tmdb_id, type, season, episode } = req.query;
    if (!title && !tmdb_id) return res.status(400).json({ error: 'Parâmetro title ou tmdb_id é obrigatório' });
    try {
        const params = new URLSearchParams({ token: pc.token });
        if (title) params.append('title', title);
        if (tmdb_id) params.append('tmdb_id', tmdb_id);
        if (type) params.append('type', type);
        if (season) params.append('season', season);
        if (episode) params.append('episode', episode);
        const response = await fetch(`${pc.url}/api/external/availability?${params}`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: `Palantir retornou HTTP ${response.status}: ${text}` });
        }
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: 'Falha ao conectar com Palantir: ' + e.message });
    }
});

app.post('/api/palantir/download', checkAdminAuth, async (req, res) => {
    const pc = getPalantirConfig();
    if (!pc) return res.status(400).json({ error: 'Palantir não configurado.' });
    const { title, tmdb_id, type, season, episode, name: dlName, url: dlUrl, category } = req.body;
    if (!title && !tmdb_id && !dlName) return res.status(400).json({ error: 'Parâmetro title, tmdb_id ou name é obrigatório' });
    try {
        const response = await fetch(`${pc.url}/api/external/download?token=${pc.token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, tmdb_id, type, season, episode, name: dlName, url: dlUrl, category }),
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: `Palantir retornou HTTP ${response.status}: ${text}` });
        }
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: 'Falha ao conectar com Palantir: ' + e.message });
    }
});

app.get('/api/palantir/progress', checkAdminAuth, async (req, res) => {
    const pc = getPalantirConfig();
    if (!pc) return res.status(400).json({ error: 'Palantir não configurado.' });
    try {
        const response = await fetch(`${pc.url}/api/external/progress?token=${pc.token}`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: `Palantir retornou HTTP ${response.status}: ${text}` });
        }
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: 'Falha ao conectar com Palantir: ' + e.message });
    }
});

// --- TRATAMENTO DE ENCERRAMENTO ---
process.on('SIGINT', () => {
    console.log('🛑 Encerrando servidor e limpando conexões...');
    process.exit(0);
});

app.post('/api/tmdb/fetch', checkAdminAuth, async (req, res) => {
    const { requestId, title, type } = req.body;
    const result = await TmdbModel.fetchAndSave(requestId, title, type);
    if (!result) return res.status(500).json({ error: 'Erro ao buscar dados do TMDB' });
    res.json(result);
});

app.get('/api/config/palantir', checkAdminAuth, (req, res) => {
    res.json({
        url: process.env.PALANTIR_API_URL || '',
        token: process.env.PALANTIR_API_TOKEN || ''
    });
});

app.post('/api/config/palantir', checkAdminAuth, express.json(), async (req, res) => {
    const { url, token } = req.body;
    if (!url || !token) {
        return res.status(400).json({ error: 'URL e Token são obrigatórios.' });
    }
    try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        let lines = envContent.split('\n');
        let hasUrl = false;
        let hasToken = false;
        
        lines = lines.map(line => {
            if (line.startsWith('PALANTIR_API_URL=')) {
                hasUrl = true;
                return `PALANTIR_API_URL=${url}`;
            }
            if (line.startsWith('PALANTIR_API_TOKEN=')) {
                hasToken = true;
                return `PALANTIR_API_TOKEN=${token}`;
            }
            return line;
        });
        
        if (!hasUrl) {
            lines.push(`PALANTIR_API_URL=${url}`);
        }
        if (!hasToken) {
            lines.push(`PALANTIR_API_TOKEN=${token}`);
        }
        
        fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
        
        process.env.PALANTIR_API_URL = url;
        process.env.PALANTIR_API_TOKEN = token;
        
        res.json({ success: true, message: 'Configurações do Palantir atualizadas com sucesso!' });
    } catch (e) {
        console.error("Erro ao salvar .env:", e);
        res.status(500).json({ error: 'Falha ao salvar configurações: ' + e.message });
    }
});

const PORT = 8901;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Painel rodando em http://127.0.0.1:${PORT}`);
    console.log(`📊 ${RequestModel.getStats().pending} pendentes, ${RequestModel.getStats().approved} aprovados, ${RequestModel.getStats().rejected} rejeitados`);
});
