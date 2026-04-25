import 'dotenv/config';
import express from 'express';
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

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configurações do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração da sessão
app.use(session({
    secret: process.env.SESSION_SECRET || (function() { throw new Error('ERRO: SESSION_SECRET não configurado no .env'); })(), 
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Use 'true' em produção com HTTPS
}));

// Inicializa o motor do WhatsApp
WhatsAppService.initialize();

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

app.get('/admin/login', (req, res) => res.render('admin/login'));

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const admin = AdminModel.authenticate(username, password); // Supondo que AdminModel.authenticate existe
    if (admin) { // Se a autenticação for bem-sucedida
        req.session.adminId = admin.id; // Armazena o ID do admin na sessão
        res.redirect('/');
    } else {
        res.render('admin/login', { error: 'Acesso negado: Credenciais inválidas.' });
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Limpa o cookie da sessão
        res.redirect('/admin/login');
    });
});

app.get('/', checkAdminAuth, (req, res) => {
    const requests = RequestModel.getAll();
    const stats = RequestModel.getStats();
    res.render('dashboard', { requests, stats });
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
    res.render('revenda/dashboard', { reseller, requests, stats, error: req.query.error });
});

// Telas de Solicitação
app.get('/revenda/solicitar', checkResellerAuth, (req, res) => {
    const resellerId = req.session.resellerId;
    const reseller = ResellerModel.getById(resellerId);
    const requests = RequestModel.getByReseller(resellerId);
    // Não passamos mais a API KEY para o frontend
    res.render('revenda/solicitar', { reseller, requests });
});
app.get('/revenda/solicitar/filme', (req, res) => res.render('revenda/buscar-filme'));

// Login e Registro
app.get('/revenda/login', (req, res) => {
    res.render('revenda/login');
});

app.post('/revenda/login', (req, res) => {
    const { email, password } = req.body;
    const reseller = ResellerModel.authenticate(email, password);
    if (reseller) { // Se a autenticação for bem-sucedida
        req.session.resellerId = reseller.id; // Armazena o ID do revendedor na sessão
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
    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }
    const updated = RequestModel.updateStatus(parseInt(req.params.id), status, rejectionReason);
    if (!updated) return res.status(404).json({ error: 'Pedido não encontrado' });

    // Enviar notificação via WhatsApp em segundo plano
    WhatsAppService.sendStatusNotification(updated).catch(e => console.error("Erro Notificação:", e));

    res.json(updated);
});

// API - Criar novo pedido
app.post('/api/requests', (req, res) => {
    const { tmdbId, title, type, action, season, episode, requestType, description, date, time } = req.body;
    
    let resellerId;

    // Se houver sessão, usa o ID do revendedor logado
    if (req.session.resellerId) {
        resellerId = req.session.resellerId;
    } else {
        return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    // Validação de limite de pedidos pendentes (máximo 10)
    const resellerRequests = RequestModel.getByReseller(resellerId);
    const pendingCount = resellerRequests.filter(r => r.status === 'pending').length;
    if (pendingCount >= 10 && requestType !== 'error') {
        return res.status(403).json({ 
            error: '⚠️ Limite atingido: Você possui 10 pedidos pendentes. No momento, só é permitido reportar erros.' 
        });
    }

    // Verificar se já existe um pedido para este TMDB ID (pendente ou aprovado)
    if (tmdbId) {
        const isDuplicate = RequestModel.checkDuplicate(parseInt(tmdbId));
        if (isDuplicate) {
            return res.status(409).json({ 
                error: 'este pedido ja foi feito por outro revenda e esta na fila de espera, favor aguardar.' 
            });
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
        tmdbId: tmdbId ? parseInt(tmdbId) : null
    });

    // Busca posters e dados do TMDB em segundo plano
    TmdbModel.fetchAndSave(request.id, title, type, tmdbId).catch(e => console.error("Erro TMDB:", e));
    
    res.status(201).json(request);
});

// API - Revendedores
app.get('/api/resellers', (req, res) => {
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

// API para Editar Revendedor
app.put('/api/resellers/:id', checkAdminAuth, (req, res) => {
    const { name, email, phone, whatsapp, password } = req.body;
    const id = req.params.id;
    const result = db.prepare(`
        UPDATE resellers 
        SET name = ?, email = ?, phone = ?, whatsapp = ?, password = ?
        WHERE id = ?
    `).run(name, email, phone, whatsapp, password, id);
    res.json({ success: result.changes > 0 });
});

app.get('/api/resellers/:id', (req, res) => {
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
app.get('/api/whatsapp/status', checkAdminAuth, (req, res) => {
    res.json(WhatsAppService.getStatus());
});

// API - TMDB
app.get('/api/tmdb/:requestId', (req, res) => {
    const tmdbData = TmdbModel.getByRequestId(parseInt(req.params.requestId));
    if (!tmdbData) return res.status(404).json({ error: 'Dados TMDB não encontrados' });
    res.json(tmdbData);
});

app.post('/api/tmdb/fetch', async (req, res) => {
    const { requestId, title, type } = req.body;
    const result = await TmdbModel.fetchAndSave(requestId, title, type);
    if (!result) return res.status(500).json({ error: 'Erro ao buscar dados do TMDB' });
    res.json(result);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Painel rodando em http://localhost:${PORT}`);
    console.log(`📊 ${RequestModel.getStats().pending} pendentes, ${RequestModel.getStats().approved} aprovados, ${RequestModel.getStats().rejected} rejeitados`);
});
