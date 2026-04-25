import 'dotenv/config';
import { exec } from 'child_process';
import path from 'path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

export class WhatsAppService {
    static client = null;
    static lastQR = null;
    static status = 'disconnected'; // disconnected, qr, ready
    static isInitializing = false;

    /**
     * Mata processos órfãos do Chrome no Windows para liberar arquivos bloqueados (EBUSY)
     */
    static async forceKillBrowser() {
        if (process.platform !== 'win32') return;
        
        return new Promise((resolve) => {
            console.log('⚔️ Executando limpeza forçada de processos do Chrome...');
            // /F = Força a interrupção | /IM = Nome da imagem | /T = Mata processos filhos também
            exec('taskkill /F /IM chrome.exe /T', (err) => {
                // Ignoramos o erro se não houver processos para matar
                if (err) console.log('ℹ️ Nenhum processo zumbi encontrado ou permissão negada.');
                else console.log('✅ Processos órfãos finalizados.');
                resolve();
            });
        });
    }

    static async initialize() { // Tornar a função assíncrona para usar 'await'
        // Trava de segurança: impede múltiplas inicializações simultâneas
        if (this.isInitializing) {
            console.log('ℹ️ Uma inicialização já está em curso. Aguarde...');
            return;
        }
        
        if (this.status === 'ready' && this.client) return;

        this.isInitializing = true;

        // Antes de qualquer coisa, tentamos matar processos antigos que possam estar travando o banco
        await this.forceKillBrowser();

        if (this.client) {
            console.log('🧹 Detectada instância anterior. Finalizando processos para evitar conflitos...');
            try {
                // Remove todos os ouvintes de eventos para evitar logs duplicados
                this.client.removeAllListeners();
                await this.client.destroy();
            } catch (e) {
                console.log('⚠️ Erro ao destruir cliente antigo (ignorado):', e.message);
            }
            this.client = null;
            this.status = 'disconnected';
            // Pequeno delay após o kill para o Windows processar a liberação dos arquivos
            await new Promise(r => setTimeout(r, 2000));
        }
        this.status = 'loading';

        this.client = new Client({
            authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
            puppeteer: {
                // Adicionando timers para evitar que o processo fique órfão
                authTimeoutMs: 60000,
                qrMaxRetries: 5,
                handleSIGINT: false,
                handleSIGHUP: false,
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
            try {
                console.log('⚡ QR Code recebido. Convertendo para imagem...');
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
            console.log('📡 Conexão encerrada pelo WhatsApp.');
            this.status = 'disconnected';
            this.lastQR = null;
            this.isInitializing = false;
            if (this.client) {
                this.client.removeAllListeners();
                this.client.destroy().catch(() => {});
                this.client = null;
            }
        });

        this.client.on('auth_failure', (msg) => {
            console.error('❌ Falha na autenticação do WhatsApp:', msg);
            this.isInitializing = false;
            this.status = 'disconnected';
        });

        this.client.initialize().catch(async err => {
            console.error('❌ Erro no motor do WhatsApp:', err.message);
            await this.logout();
        });
    }

    static getStatus() {
        return { status: this.status, qr: this.lastQR };
    }

    static async logout() {
        console.log('🚪 Executando limpeza de sessão do WhatsApp...');
        try {
            this.lastQR = null;
            this.isInitializing = false;
            this.status = 'disconnected';
            
            if (this.client) {
                this.client.removeAllListeners();
                await this.client.destroy().catch(() => {});
                this.client = null;
            }

            // Executa o kill para garantir que o Chrome fechou mesmo
            await this.forceKillBrowser();
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