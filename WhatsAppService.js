import 'dotenv/config';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

export class WhatsAppService {
    static client = null;
    static lastQR = null;
    static status = 'disconnected'; // disconnected, qr, ready

    static initialize() {
        if (this.client) return;

        this.client = new Client({
            authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
            puppeteer: {
                handleSIGINT: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        this.client.on('qr', async (qr) => {
            console.log('⚡ Novo QR Code gerado.');
            this.status = 'qr';
            this.lastQR = await qrcode.toDataURL(qr);
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

        this.client.initialize().catch(err => console.error('Erro ao iniciar WhatsApp:', err));
    }

    static getStatus() {
        return { status: this.status, qr: this.lastQR };
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