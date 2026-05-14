import 'dotenv/config';

export class BotBotService {
    static BOTBOT_API = 'https://botbot.chat/api/v2';
    
    // Chaves de acesso conforme validado
    static APP_KEY = process.env.BOTBOT_APP_KEY || '<BOTBOT_APP_KEY>';
    static AUTH_KEY = process.env.BOTBOT_AUTH_KEY || '<BOTBOT_AUTH_KEY>';

    static async getStatus() {
        // Serviço em nuvem não precisa ler QR code
        return { status: 'ready', qr: null };
    }

    static async sendStatusNotification(request) {
        const { reseller, whatsapp, title, status, rejectionReason } = request;
        
        // A API BotBot.chat exige DDI (55 para Brasil). Extrai só números.
        let cleanNumber = whatsapp.replace(/\D/g, '');
        if (cleanNumber.length >= 10 && !cleanNumber.startsWith('55')) {
            cleanNumber = '55' + cleanNumber;
        }
        
        let message = '';
        if (status === 'approved') message = `✅ *PEDIDO APROVADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi aprovado!`;
        else if (status === 'rejected') message = `❌ *PEDIDO REJEITADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi rejeitado.\nMotivo: ${rejectionReason || 'Não especificado'}`;

        if (!message) return false;

        try {
            const response = await fetch(`${this.BOTBOT_API}/sendText`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'appKey': this.APP_KEY,
                    'authKey': this.AUTH_KEY
                },
                body: JSON.stringify({ 
                    to: cleanNumber, 
                    message: message,
                    typingDelay: 1
                })
            });
            
            const data = await response.json();
            if (response.ok) {
                console.log(`📩 [BotBot] Notificação enviada para ${cleanNumber} com sucesso!`);
                return true;
            } else {
                console.error(`❌ [BotBot] Erro API BotBot:`, data.message || data.error);
                return false;
            }
        } catch (e) {
            console.error('⚠️ [BotBot] Falha crítica de conexão:', e.message);
            return false;
        }
    }
}