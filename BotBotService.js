import db from './db.js';

export class BotBotService {
    static BOTBOT_API = 'https://botbot.chat/api/v2';
    
    static getCredentials() {
        const appKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'BOTBOT_APP_KEY'").get();
        const authKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'BOTBOT_AUTH_KEY'").get();
        
        return {
            appKey: appKeyRow ? appKeyRow.value : '',
            authKey: authKeyRow ? authKeyRow.value : ''
        };
    }

    static saveCredentials(appKey, authKey) {
        const stmt = db.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        const runMany = db.transaction(() => {
            stmt.run('BOTBOT_APP_KEY', appKey);
            stmt.run('BOTBOT_AUTH_KEY', authKey);
        });
        runMany();
    }

    static async getStatus() {
        const creds = this.getCredentials();
        if (!creds.appKey || !creds.authKey) {
            return { status: 'disconnected', qr: null };
        }

        try {
            const response = await fetch(`${this.BOTBOT_API}/sendText`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'appKey': creds.appKey,
                    'authKey': creds.authKey
                },
                body: JSON.stringify({ to: '<TELEFONE>', message: 'ping', typingDelay: 1 })
            });

            const text = await response.text();
            const data = JSON.parse(text);

            // Se veio erro específico de "bot não conectado", está offline
            if (data.error && data.error.includes('não está mais conectado')) {
                return { status: 'disconnected', error: data.error };
            }

            // Qualquer outra resposta JSON indica que a API está respondendo e o bot ativo
            return { status: 'ready', qr: null };
        } catch (e) {
            return { status: 'disconnected', error: 'Falha de conexão: ' + e.message };
        }
    }

    static async sendStatusNotification(request) {
        const { reseller, whatsapp, title, status, rejectionReason } = request;
        
        // A API BotBot.chat exige DDI (55 para Brasil). Extrai só números.
        let cleanNumber = whatsapp.replace(/\D/g, '');
        if (cleanNumber.length >= 10 && !cleanNumber.startsWith('55')) {
            cleanNumber = '55' + cleanNumber;
        }
        
        let message = '';
        if (status === 'approved') {
            message = `✅ *PEDIDO APROVADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi aprovado!`;
        } else if (status === 'rejected') {
            const reason = (rejectionReason || '').toLowerCase();
            if (reason.includes('já consta') || reason.includes('ja consta') || reason.includes('já está') || reason.includes('ja esta')) {
                message = `*Já Consta no Servidor.*\n\nFavor pesquisar nas categorias *All* ou todas as categorias individuais antes de solicitar os conteúdos.\n\nOs pedidos seguem uma ordem que vai da fila de chegada a data de lançamento e disponibilidade, isso pode variar, então não podemos dar prazos para a inserção do conteúdo na grade.\n\nSempre que um Revendedor faz um pedido sem consultar a grade de conteúdos antes ele congestiona ainda mais a fila de pedidos com conteúdos que já estão na grade, atrasando ainda mais os pedidos.\n\nPor isso ressaltamos sempre:\n*Pesquisar nas categorias All ou todas as categorias individuais antes de solicitar os conteúdos.*`;
            } else {
                message = `❌ *PEDIDO REJEITADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi rejeitado.\nMotivo: ${rejectionReason || 'Não especificado'}`;
            }
        }

        if (!message) return false;

        const creds = this.getCredentials();
        if (!creds.appKey || !creds.authKey) {
            console.error('❌ [BotBot] Chaves da API não configuradas no painel.');
            return false;
        }

        try {
            const response = await fetch(`${this.BOTBOT_API}/sendText`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'appKey': creds.appKey,
                    'authKey': creds.authKey
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