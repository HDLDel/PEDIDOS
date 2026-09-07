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
            message = `✅ *PEDIDO APROVADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi aprovado!\n\nSeu conteúdo será inserido na grade em até 48 horas.`;
        } else if (status === 'rejected') {
            message = `❌ *PEDIDO REJEITADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi rejeitado.\nMotivo: ${rejectionReason || 'Não especificado'}`;
        }

        if (!message) return false;

        const creds = this.getCredentials();
        if (!creds.appKey || !creds.authKey) {
            console.error('❌ [BotBot] Chaves da API não configuradas no painel.');
            return false;
        }

        // Dividir a mensagem em múltiplos blocos por parágrafo (\n\n) para preservar formatação
        const messages = message.split('\n\n').filter(Boolean);
        let allSuccess = true;

        for (let i = 0; i < messages.length; i++) {
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
                        message: messages[i],
                        typingDelay: 1
                    })
                });
                
                const data = await response.json();
                if (response.ok) {
                    console.log(`📩 [BotBot] Notificação ${i + 1}/${messages.length} enviada para ${cleanNumber} com sucesso!`);
                } else {
                    console.error(`❌ [BotBot] Erro API BotBot (msg ${i + 1}/${messages.length}):`, data.message || data.error);
                    allSuccess = false;
                }
            } catch (e) {
                console.error(`⚠️ [BotBot] Falha crítica de conexão (msg ${i + 1}/${messages.length}):`, e.message);
                allSuccess = false;
            }

            // Intervalo de 1.5s entre parágrafos para garantir ordem no WhatsApp
            if (i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        return allSuccess;
    }
}