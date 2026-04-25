import 'dotenv/config';
import express from 'express';
import { exec } from 'child_process';
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
    // Se já estiver tentando carregar ou já estiver pronto, ignora para não duplicar
    if (status === 'loading' || status === 'qr' || status === 'ready') {
        console.log(`ℹ️ [WA-SERVER] Ignorando tentativa de início: Status atual é ${status}`);
        return;
    }

    status = 'loading';
    console.log('⏳ [WA-SERVER] Iniciando navegador Puppeteer...');

    // Se houver um cliente antigo "sujo" na memória, tentamos destruir antes de começar
    if (client) {
        try {
            await client.destroy();
        } catch (e) {}
        client = null;
    }

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
        puppeteer: {
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--disable-extensions',
                '--no-zygote',
                '--no-first-run',
                '--single-process', // Reduz o uso de memória em ambientes Linux
                '--disable-setuid-sandbox',
                '--no-sandbox',
                // Limita o uso de memória do motor V8 do Chrome
                '--js-flags="--max-old-space-size=512"'
            ],
            headless: true
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

    client.initialize().catch(async err => {
        console.error('❌ [WA-SERVER] Erro Crítico na Inicialização:', err.message);
        status = 'disconnected';
        lastQR = null;
        if (client) {
            await client.destroy().catch(() => {});
        }
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