import 'dotenv/config';
import express from 'express';
import path from 'path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

const app = express();
app.use(express.json());

let client = null;
let status = 'disconnected';
let lastQR = null;

async function initWhatsApp() {
    if (client && (status === 'loading' || status === 'qr' || status === 'ready')) return;

    status = 'loading';
    console.log('⏳ [WA-SERVER] Iniciando navegador Puppeteer...');

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        }
    });

    client.on('qr', async (qr) => {
        lastQR = await qrcode.toDataURL(qr);
        status = 'qr';
        console.log('⚡ [WA-SERVER] Novo QR Code gerado.');
    });

    client.on('ready', () => {
        status = 'ready';
        lastQR = null;
        console.log('✅ [WA-SERVER] WhatsApp Conectado!');
    });

    client.on('disconnected', () => {
        status = 'disconnected';
        client = null;
        console.log('❌ [WA-SERVER] Desconectado.');
    });

    client.initialize().catch(err => {
        console.error('❌ [WA-SERVER] Erro:', err.message);
        status = 'disconnected';
        client = null;
    });
}

// Endpoints para o Dashboard consultar
app.get('/status', (req, res) => res.json({ status, qr: lastQR }));

app.post('/start', (req, res) => {
    initWhatsApp();
    res.json({ success: true });
});

app.post('/logout', async (req, res) => {
    if (client) {
        try {
            await client.destroy();
            client = null;
            status = 'disconnected';
            lastQR = null;
        } catch (e) {}
    }
    res.json({ success: true });
});

app.post('/send', async (req, res) => {
    const { chatId, content } = req.body;
    if (status !== 'ready' || !client) return res.status(503).json({ error: 'WhatsApp offline' });

    try {
        await client.sendMessage(chatId, content);
        console.log(`📩 [WA-SERVER] Mensagem enviada para ${chatId}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`📡 MOTOR WHATSAPP INDEPENDENTE: Rodando na porta ${PORT}`);
});

process.on('uncaughtException', (e) => console.error('Erro isolado no motor WA:', e.message));