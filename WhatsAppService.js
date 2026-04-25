import 'dotenv/config';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WhatsAppService {
    static worker = null;
    static lastQR = null;
    static status = 'disconnected'; 
    static isInitializing = false;

    static async initialize() {
        if (this.isInitializing || (this.status === 'ready' && this.worker)) return;
        
        this.isInitializing = true;
        this.status = 'loading';

        // Se já existe um worker, mata ele antes de iniciar um novo
        if (this.worker) {
            this.worker.kill();
            await new Promise(r => setTimeout(r, 2000));
        }

        // Cria o processo separado
        this.worker = fork(path.join(__dirname, 'whatsapp-worker.js'));
        console.log('🚀 [Manager] Worker do WhatsApp iniciado em processo separado.');

        this.worker.on('message', (msg) => {
            if (msg.type === 'status') {
                this.status = msg.status;
                this.lastQR = msg.qr || null;
                if (msg.status === 'ready') {
                    this.isInitializing = false;
                    this.lastQR = null;
                }
            }
            if (msg.type === 'error') {
                console.error('[Manager] Erro no Worker:', msg.message);
                this.status = 'disconnected';
                this.isInitializing = false;
            }
        });

        this.worker.on('exit', (code) => {
            console.log(`⚠️ [Manager] Worker encerrou com código ${code}.`);
            this.status = 'disconnected';
            this.isInitializing = false;
            this.worker = null;
        });
    }

    static getStatus() {
        return { status: this.status, qr: this.lastQR };
    }

    static async logout() {
        if (this.worker) {
            this.worker.send({ type: 'logout' });
            this.isInitializing = false;
            this.status = 'disconnected';
            this.lastQR = null;
        }
    }

    static async sendStatusNotification(request) {
        if (this.status !== 'ready') {
            console.warn('⚠️ WhatsApp não está conectado. Pulando notificação.');
            return;
        }

        const { reseller, whatsapp, title, status, rejectionReason } = request;
        const cleanNumber = whatsapp.replace(/\D/g, '');
        const chatId = `${cleanNumber}@c.us`;
        
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

        if (message && this.worker) {
            this.worker.send({ type: 'send_message', chatId, content: message });
        }
    }
}