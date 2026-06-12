import 'dotenv/config';

export class WhatsAppService {
    static WA_API = 'http://localhost:8880';

    static async initialize() {
        try {
            await fetch(`${this.WA_API}/start`, { method: 'POST' });
        } catch (e) {
            console.error('❌ Não foi possível conectar ao Servidor Independente do WhatsApp na porta 8880.');
        }
    }

    static async getStatus() {
        try {
            const res = await fetch(`${this.WA_API}/status`);
            return await res.json();
        } catch (e) {
            return { status: 'disconnected', qr: null };
        }
    }

    static async logout() {
        try {
            await fetch(`${this.WA_API}/logout`, { method: 'POST' });
        } catch (e) {}
    }

    static async sendStatusNotification(request) {
        const { reseller, whatsapp, title, status, rejectionReason } = request;
        const cleanNumber = whatsapp.replace(/\D/g, '');
        const chatId = `${cleanNumber}@c.us`;
        
        let message = '';
        if (status === 'approved') message = `✅ *PEDIDO APROVADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi aprovado!`;
        else if (status === 'rejected') message = `❌ *PEDIDO REJEITADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi rejeitado.\nMotivo: ${rejectionReason || 'Não especificado'}`;

        if (!message) return;

        try {
            await fetch(`${this.WA_API}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, content: message })
            });
        } catch (e) {
            console.error('⚠️ Falha ao pedir envio de WhatsApp ao servidor motor.');
        }
    }
}