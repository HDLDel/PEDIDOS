import 'dotenv/config';
import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
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
    console.log('⏳ [WA-SERVER] Preparando inicialização do Puppeteer...');

    try {
        const sessionPath = path.join(process.cwd(), '.wwebjs_auth', 'session-primary-client');

        // Limpeza de trava do Puppeteer (Evita o erro "The browser is already running")
        try {
            if (fs.existsSync(sessionPath)) {
                console.log('🧹 [WA-SERVER] Verificando e limpando travas de sessão...');
                ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(file => {
                    const filePath = path.join(sessionPath, file);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });
            }
        } catch (e) { console.log('ℹ️ [WA-SERVER] Pasta de sessão limpa ou inexistente.'); }

        // Limpeza preventiva de instâncias anteriores
        if (client) {
            console.log('🧹 [WA-SERVER] Limpando cliente anterior...');
            await client.destroy().catch(() => {});
            client = null;
        }

        client = new Client({
            authStrategy: new LocalAuth({ 
                dataPath: path.join(process.cwd(), '.wwebjs_auth'),
                clientId: "primary-client" 
            }),
            puppeteer: {
                headless: true,
                executablePath: process.platform === 'linux' ? '/usr/bin/google-chrome' : undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        console.log('📡 [WA-SERVER] Instância do cliente criada. Aguardando eventos...');

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

        console.log('🚀 [WA-SERVER] Chamando initialize()...');
        await client.initialize();

    } catch (err) {
        console.error('❌ [WA-SERVER] Falha ao iniciar WhatsApp:', err.message);
        status = 'disconnected';
        lastQR = null;
        client = null;
    }
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
            await client.logout(); // Remove o aparelho vinculado do seu celular
            await client.destroy();
            client = null;
            status = 'disconnected';
            lastQR = null;
        } catch (e) {}
    }
    
    // Apaga a pasta local da sessão para forçar um novo QR Code
    const sessionPath = path.join(process.cwd(), '.wwebjs_auth', 'session-primary-client');
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
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

const PORT = 8880;
app.listen(PORT, () => {
    console.log(`📡 MOTOR WHATSAPP INDEPENDENTE: Rodando na porta ${PORT}`);
});

process.on('uncaughtException', (e) => console.error('Erro isolado no motor WA:', e.message));