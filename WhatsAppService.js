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
        if (status === 'approved') message = `✅ *PEDIDO APROVADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi aprovado!`;
        else if (status === 'rejected') {
            const reason = (rejectionReason || '').toLowerCase();
            if (reason.includes('já consta') || reason.includes('ja consta') || reason.includes('já está') || reason.includes('ja esta')) {
                message = `*Já Consta no Servidor.*\n\nFavor pesquisar nas categorias All ou todas as categorias individuais antes de solicitar os conteúdos.\n\nOs pedidos sequem uma ordem que vai da fila de chegada a data de lançamento e disponibilidade, isso pode variar, então não podemos dar prazos para a inserção do conteúdo na grade.\n\nSempre que um Revendedor faz um pedido sem consultar a grade de conteúdos antes ele congestiona ainda mais a fila de pedidos com conteúdos que já estão na grade, atrasando ainda mais os pedidos.\n\nPor isso ressaltamos sempre:\n*Pesquisar nas categorias All ou todas as categorias individuais antes de solicitar os conteúdos.*`;
            } else {
                message = `❌ *PEDIDO REJEITADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi rejeitado.\nMotivo: ${rejectionReason || 'Não especificado'}`;
            }
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