// Orquestração das notificações no server.js do PEDIDOS VOD.
// Trechos reais do código: fluxo de aprovação/rejeição e reenvio em lote.

import { BotBotService } from './BotBotService.js';
import { WhatsAppService } from './WhatsAppService.js';

// ---------------------------------------------------------------
// 1) Rota de aprovar/rejeitar pedido (POST /api/requests/:id/status)
// ---------------------------------------------------------------
app.post('/api/requests/:id/status', checkAdminAuth, (req, res) => {
    const { status, rejectionReason } = req.body;
    const syncAll = req.body.syncAll !== false; // Padrão é true, só false se declarado
    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }

    const id = parseInt(req.params.id);
    const updated = RequestModel.updateStatus(id, status, rejectionReason);
    if (!updated) return res.status(404).json({ error: 'Pedido não encontrado' });

    // LÓGICA DE BACKUP: Tenta BotBot primeiro, se falhar ou cair, o Local Assume!
    const trySendNotification = async (reqData) => {
        const bbSuccess = await BotBotService.sendStatusNotification(reqData);
        if (!bbSuccess) {
            console.log('⚠️ BotBot indisponível. Acionando Motor WhatsApp Local como backup...');
            WhatsAppService.sendStatusNotification(reqData).catch(e => console.error("Erro Notificação Backup:", e));
        }
    };

    // SINCRONIZAÇÃO: Se for um conteúdo TMDB, atualiza todos os outros revendedores que pediram o mesmo
    if (syncAll) {
        const tmdbData = TmdbModel.getByRequestId(id);
        if (tmdbData && tmdbData.tmdb_id) {
            const siblings = db.prepare(`
                SELECT r.id, res.name as reseller, res.whatsapp, r.title
                FROM requests r
                JOIN resellers res ON r.reseller_id = res.id
                JOIN tmdb_contents t ON r.id = t.request_id
                WHERE t.tmdb_id = ? AND r.status = 'pending' AND r.id != ?
            `).all(tmdbData.tmdb_id, id);

            for (const sibling of siblings) {
                RequestModel.updateStatus(sibling.id, status, rejectionReason);
                trySendNotification({ ...sibling, status, rejectionReason });
            }
        }
    }

    trySendNotification(updated);

    res.json(updated);
});

// ---------------------------------------------------------------
// 2) Reenvio em lote (POST /api/notifications/resend-all)
// ---------------------------------------------------------------
app.post('/api/notifications/resend-all', checkAdminAuth, async (req, res) => {
    if (isResendingBackground) {
        return res.status(429).json({ message: '❌ Um reenvio em lote já está em andamento. Aguarde a finalização do processo atual antes de iniciar outro.' });
    }

    const requests = RequestModel.getAll().filter(r => r.status !== 'pending').slice(0, 50);

    isResendingBackground = true;

    const trySendNotification = async (reqData) => {
        const bbSuccess = await BotBotService.sendStatusNotification(reqData);
        if (!bbSuccess) {
            WhatsAppService.sendStatusNotification(reqData).catch(e => console.error("Erro Notificação Backup:", e));
        }
    };

    setTimeout(async () => {
        console.log(`🚀 Iniciando reenvio em lote de ${requests.length} notificações...`);
        for (const r of requests) {
            await trySendNotification(r);
            await new Promise(resolve => setTimeout(resolve, 36000));
        }
        console.log(`✅ Reenvio em lote finalizado!`);
        isResendingBackground = false;
    }, 100);
});