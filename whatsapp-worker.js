import 'dotenv/config';
import path from 'path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
    puppeteer: {
        authTimeoutMs: 60000,
        qrMaxRetries: 5,
        handleSIGINT: false,
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    process.send({ type: 'status', status: 'qr', qr: qrImage });
});

client.on('loading_screen', (percent) => {
    process.send({ type: 'status', status: 'loading', percent });
});

client.on('authenticated', () => {
    process.send({ type: 'status', status: 'authenticated' });
});

client.on('ready', () => {
    process.send({ type: 'status', status: 'ready' });
});

client.on('disconnected', () => {
    process.send({ type: 'status', status: 'disconnected' });
    process.exit(0); // Força o worker a fechar para o manager reiniciar limpo
});

client.on('auth_failure', (msg) => {
    process.send({ type: 'error', message: 'Falha na autenticação: ' + msg });
    process.exit(1);
});

// Escuta comandos do processo pai (Servidor)
process.on('message', async (msg) => {
    if (msg.type === 'send_message') {
        try {
            await client.sendMessage(msg.chatId, msg.content);
            console.log(`[Worker] Mensagem enviada para ${msg.chatId}`);
        } catch (e) {
            console.error(`[Worker] Erro ao enviar:`, e.message);
        }
    }
    
    if (msg.type === 'logout') {
        try {
            await client.logout();
            await client.destroy();
            process.exit(0);
        } catch (e) {
            process.exit(1);
        }
    }
});

console.log('[Worker] Iniciando motor do WhatsApp...');
client.initialize().catch(err => {
    console.error('[Worker] Erro de inicialização:', err.message);
    process.exit(1);
});

// Previne que erros não tratados derrubem o worker sem avisar o pai
process.on('unhandledRejection', (reason) => console.error('[Worker] Rejeição:', reason));
process.on('uncaughtException', (err) => console.error('[Worker] Exceção:', err));