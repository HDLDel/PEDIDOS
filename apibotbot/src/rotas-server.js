// Rotas Express do BotBot no server.js do PEDIDOS VOD (trechos reais).

// Import (a partir de BotBotService.js):
// import { BotBotService } from './BotBotService.js';

// Rota para Conexão do BotBot (página de configuração)
app.get('/admin/botbot', checkAdminAuth, (req, res) => {
    const creds = BotBotService.getCredentials();
    res.render('admin/botbot', { appKey: creds.appKey, authKey: creds.authKey });
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