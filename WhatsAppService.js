import 'dotenv/config';

export class WhatsAppService {
    static WA_API = 'http://localhost:8880';
    static headers = {
        'Content-Type': 'application/json',
        'x-api-token': process.env.WHATSAPP_API_TOKEN || ''
    };

    static async initialize() {
        try {
            await fetch(`${this.WA_API}/start`, { method: 'POST', headers: this.headers });
        } catch (e) {
            console.error('❌ Não foi possível conectar ao Servidor Independente do WhatsApp na porta 8880.');
        }
    }

    static async getStatus() {
        try {
            const res = await fetch(`${this.WA_API}/status`, { headers: this.headers });
            return await res.json();
        } catch (e) {
            return { status: 'disconnected', qr: null };
        }
    }

    static async logout() {
        try {
            await fetch(`${this.WA_API}/logout`, { method: 'POST', headers: this.headers });
        } catch (e) {}
    }

    static async sendStatusNotification(request) {
        const { reseller, whatsapp, title, status, rejectionReason } = request;
        const cleanNumber = whatsapp.replace(/\D/g, '');
        const chatId = `${cleanNumber}@c.us`;
        
        let message = '';
        if (status === 'approved') message = `✅ *PEDIDO APROVADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi aprovado!\n\nSeu conteúdo será inserido na grade em até 48 horas.`;
        else if (status === 'rejected') {
            message = `❌ *PEDIDO REJEITADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi rejeitado.\nMotivo: ${rejectionReason || 'Não especificado'}`;
        }

        if (!message) return;

        try {
            await fetch(`${this.WA_API}/send`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ chatId, content: message })
            });
        } catch (e) {
            console.error('⚠️ Falha ao pedir envio de WhatsApp ao servidor motor.');
        }
    }
}