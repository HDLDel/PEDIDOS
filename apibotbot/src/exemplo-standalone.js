// =============================================================
// EXEMPLO STANDALONE — Integração BotBot.chat v2 em outro projeto
// =============================================================
// Rodar: node exemplo-standalone.js
// Requer Node.js >= 18 (fetch nativo).
// Sem nenhuma dependência. Chaves via variáveis de ambiente.
// =============================================================

const BOTBOT_API = 'https://botbot.chat/api/v2';

const APP_KEY = process.env.BOTBOT_APP_KEY || '<BOTBOT_APP_KEY>';
const AUTH_KEY = process.env.BOTBOT_AUTH_KEY || '<BOTBOT_AUTH_KEY>';
const DESTINO_TESTE = process.env.BOTBOT_TEST_PHONE || '<TELEFONE_TESTE>';

// -------------------------------------------------------------
// 1) Enviar mensagem simples
// -------------------------------------------------------------
async function sendText(to, message, typingDelay = 1) {
    const response = await fetch(`${BOTBOT_API}/sendText`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'appKey': APP_KEY,
            'authKey': AUTH_KEY
        },
        body: JSON.stringify({ to, message, typingDelay })
    });

    const data = await response.json();

    if (response.ok) {
        console.log(`📩 Mensagem enviada para ${to}:`, data.messageStatus);
        return true;
    }

    // Erro específico de bot desconectado
    if (data.error && data.error.includes('não está mais conectado')) {
        console.error('❌ Bot está OFFLINE no painel BotBot.chat.');
    } else {
        console.error(`❌ Erro ${response.status}:`, data.error || data.message || JSON.stringify(data));
    }
    return false;
}

// -------------------------------------------------------------
// 2) Verificar status do bot (envia ping sem custo real)
// -------------------------------------------------------------
async function checkStatus() {
    try {
        const ok = await sendText('<TELEFONE>', 'ping');
        return ok ? 'ready' : 'disconnected';
    } catch (e) {
        console.error('⚠️ Falha de conexão:', e.message);
        return 'disconnected';
    }
}

// -------------------------------------------------------------
// 3) Normalizar número para o formato brasileiro (DDI 55)
// -------------------------------------------------------------
function normalizePhone(number) {
    let clean = String(number).replace(/\D/g, '');
    if (clean.length >= 10 && !clean.startsWith('55')) {
        clean = '55' + clean;
    }
    return clean;
}

// -------------------------------------------------------------
// 4) Notificação de aprovação/rejeição (dividida por parágrafos)
// -------------------------------------------------------------
async function sendStatusNotification({ reseller, whatsapp, title, status, rejectionReason }) {
    let message = '';
    if (status === 'approved') {
        message = `✅ *PEDIDO APROVADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi aprovado!\n\nSeu conteúdo será inserido na grade em até 48 horas.`;
    } else if (status === 'rejected') {
        message = `❌ *PEDIDO REJEITADO*\n\nOlá *${reseller}*, seu pedido *${title}* foi rejeitado.\nMotivo: ${rejectionReason || 'Não especificado'}`;
    }

    if (!message) return false;

    const to = normalizePhone(whatsapp);
    const blocks = message.split('\n\n').filter(Boolean);
    let allSuccess = true;

    for (let i = 0; i < blocks.length; i++) {
        try {
            const ok = await sendText(to, blocks[i]);
            if (!ok) allSuccess = false;
        } catch (e) {
            console.error(`⚠️ Falha crítica (bloco ${i + 1}/${blocks.length}):`, e.message);
            allSuccess = false;
        }

        // Intervalo de 1.5s entre parágrafos para garantir ordem no WhatsApp
        if (i < blocks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    return allSuccess;
}

// -------------------------------------------------------------
// 5) Exemplo de uso
// -------------------------------------------------------------
async function main() {
    console.log('🔍 Verificando status do bot...');
    console.log('Status:', await checkStatus());

    console.log('\n📨 Testando envio simples...');
    await sendText(DESTINO_TESTE, 'Teste BotBot (exemplo standalone)');

    console.log('\n✅ Notificação de aprovação (exemplo):');
    await sendStatusNotification({
        reseller: 'Revenda Exemplo',
        whatsapp: DESTINO_TESTE,
        title: 'Divertida Mente (2024)',
        status: 'approved'
    });
}

main();