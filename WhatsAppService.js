import 'dotenv/config';
import path from 'path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

export class WhatsAppService {
    static client = null;
    static lastQR = null;
    static status = 'disconnected'; // disconnected, qr, ready
    static isInitializing = false;

    static async initialize() { // Tornar a função assíncrona para usar 'await'
        // Se já está em processo de ligar ou já está ativo, ignora novos pedidos de boot
        if (this.isInitializing) return;
        if (this.client && this.status !== 'disconnected') return;

        this.isInitializing = true;

        if (this.client) {
            console.log('🧹 Limpando instância anterior do WhatsApp...');
            await this.client.destroy().catch(e => console.error('Erro ao destruir instância anterior:', e));
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
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-extensions',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            }
        });

        // Handler de erro fundamental para evitar queda do servidor
        this.client.on('error', (err) => {
            console.error('❌ Erro no cliente WhatsApp:', err.message);
            this.status = 'disconnected';
            this.lastQR = null;
        });

        this.client.on('qr', async (qr) => {
            console.log('⚡ Gerando imagem do QR Code...');
            try {
                this.lastQR = await qrcode.toDataURL(qr);
                this.status = 'qr';
                console.log('✅ QR Code pronto para exibição.');
            } catch (e) {
                console.error('Erro ao converter QR Code:', e);
            }
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
            this.isInitializing = false;
            this.lastQR = null;
        });

        this.client.on('disconnected', () => {
            console.log('📡 WhatsApp desconectado via evento.');
            this.status = 'disconnected';
            this.lastQR = null;
            this.isInitializing = false;
            // Não é necessário chamar destroy() aqui, initialize() fará isso se for chamado novamente.
            this.client = null; // Apenas define o cliente como nulo para indicar que não está ativo.
        });

        this.client.on('auth_failure', (msg) => {
            console.error('❌ Falha na autenticação:', msg);
            this.isInitializing = false;
            this.status = 'disconnected';
        });

        this.client.initialize().catch(err => {
            console.error('❌ Erro fatal na inicialização do WhatsApp:', err.message);
            this.isInitializing = false;
            this.status = 'disconnected';
            this.client = null;
        });
    }

    static getStatus() {
        return { status: this.status, qr: this.lastQR };
    }

    static async logout() {
        console.log('🚪 Iniciando processo de logout do WhatsApp...');
        this.isInitializing = false;
        try {
            this.lastQR = null;
            
            if (this.client) {
                // Primeiro destruímos o navegador para liberar os bloqueios de arquivo do Windows
                await this.client.destroy().catch(() => {});
                this.client = null;
                this.status = 'disconnected';
            }
            
            // Não reinicializa automaticamente após o logout. O usuário pode iniciar via UI.
        } catch (e) { 
            console.error('❌ Erro crítico ao deslogar WhatsApp:', e); 
        }
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