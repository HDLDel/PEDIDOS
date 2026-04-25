import 'dotenv/config';
import path from 'path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

export class WhatsAppService {
    static client = null;
    static lastQR = null;
    static status = 'disconnected'; // disconnected, qr, ready

    static initialize() {
        // Se o cliente já existir e não estiver desconectado, não faz nada
        if (this.client && this.status !== 'disconnected') return;

        if (this.client) {
            this.client.destroy().catch(() => {});
            this.client = null;
        }

        this.client = new Client({
            authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
            puppeteer: {
                // Adicionando timers para evitar que o processo fique órfão
                authTimeoutMs: 60000,
                qrMaxRetries: 5,
                handleSIGINT: false,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
            }
        });

        this.client.on('qr', async (qr) => {
            // Primeiro gera a imagem, depois sinaliza o status para evitar telas brancas
            console.log('⚡ Gerando imagem do QR Code...');
            const qrImage = await qrcode.toDataURL(qr);
            this.lastQR = qrImage;
            this.status = 'qr';
            console.log('✅ QR Code pronto para exibição no painel.');
        });

        this.client.on('loading_screen', (percent, message) => {
            console.log('⏳ Carregando WhatsApp:', percent, '%');
            this.status = 'loading';
        });

        this.client.on('authenticated', () => {
            console.log('🔓 WhatsApp Autenticado!');
            this.status = 'authenticated';
        });

        this.client.on('ready', () => {
            console.log('✅ WhatsApp está pronto!');
            this.status = 'ready';
            this.lastQR = null;
        });

        this.client.on('disconnected', () => {
            console.log('❌ WhatsApp desconectado.');
            this.status = 'disconnected';
            this.lastQR = null;
        });

        this.client.on('auth_failure', (msg) => {
            console.error('❌ Falha na autenticação:', msg);
            this.status = 'disconnected';
        });

        this.client.initialize().catch(err => console.error('Erro ao iniciar WhatsApp:', err));
    }

    static getStatus() {
        return { status: this.status, qr: this.lastQR };
    }

    static async logout() {
        try {
            if (this.client) {
                await this.client.logout();
                await this.client.destroy();
                this.client = null;
                this.status = 'disconnected';
                this.initialize();
            }
        } catch (e) { console.error('Erro ao deslogar WhatsApp:', e); }
    }

    static async sendStatusNotification(request) {
        if (this.status !== 'ready') {
            console.warn('⚠️ WhatsApp não está conectado. Pulando notificação.');
            return;
        }

        const { reseller, whatsapp, title, status, rejectionReason } = request;
        const cleanNumber = whatsapp.replace(/\D/g, '');
        // Adiciona o sufixo do WhatsApp se não tiver
        const chatId = cleanNumber.includes('@c.us') ? cleanNumber : `${cleanNumber}@c.us`;
        
        let message = '';
        if (status === 'approved') {
            message = `✅ *PEDIDO APROVADO*\n\n` + 
                      `Olá *${reseller}*,\n` +
                      `Seu pedido para o conteúdo *${title}* foi aprovado pela nossa equipe e já está sendo processado!\n\n` +
                      `Acompanhe no seu painel.`;
        } else if (status === 'rejected') {
            message = `❌ *PEDIDO REJEITADO*\n\n` + 
                      `Olá *${reseller}*,\n` +
                      `Infelizmente seu pedido para *${title}* não pôde ser atendido.\n\n` +
                      `*Motivo:* ${rejectionReason || 'Não especificado.'}\n\n` +
                      `Verifique as regras no painel antes de solicitar novamente.`;
        }

        if (!message) return;

        try {
            await this.client.sendMessage(chatId, message);
            console.log(`📩 Mensagem enviada para ${reseller}`);
        } catch (error) {
            console.error('❌ Falha ao enviar mensagem WhatsApp:', error.message);
        }
    }
}