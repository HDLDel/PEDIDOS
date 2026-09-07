// Funções BotBot do painel principal (public/js/dashboard.js — trechos reais).

// --- FUNÇÕES BOTBOT ---
async function loadBotBotConfig() {
    try {
        const res = await fetch('/api/botbot/config');
        const data = await res.json();
        document.getElementById('bbConfigAppKey').value = data.appKey || '';
        document.getElementById('bbConfigAuthKey').value = data.authKey || '';
    } catch (err) {
        console.error('Erro ao buscar configuração do BotBot:', err);
    }
}

async function saveBbConfig() {
    const btn = document.getElementById('bbConfigSaveBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    const appKey = document.getElementById('bbConfigAppKey').value.trim();
    const authKey = document.getElementById('bbConfigAuthKey').value.trim();

    try {
        const res = await fetch('/api/botbot/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appKey, authKey })
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
        } else {
            alert(data.error || 'Erro ao salvar.');
        }
    } catch (err) {
        alert('Erro de conexão ao salvar.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function resendAllBbNotifications() {
    if (!confirm("Deseja reenviar a notificação dos ÚLTIMOS 50 pedidos processados? \n\nIsso pode demorar alguns minutos em segundo plano.")) return;
    
    const btn = document.getElementById('bbConfigResendAllBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/notifications/resend-all', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Processo iniciado com sucesso!');
    } catch (err) {
        alert('Erro ao iniciar reenvio.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function testBbConnection() {
    const phone = document.getElementById('bbConfigTestPhone').value.trim();
    if (!phone) { alert('Informe o telefone para teste.'); return; }

    const btn = document.getElementById('bbConfigTestBtn');
    const result = document.getElementById('bbConfigTestResult');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testando...';
    btn.disabled = true;
    result.style.display = 'none';

    try {
        const res = await fetch('/api/botbot/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        result.style.display = 'block';
        if (res.ok && data.success) {
            result.style.background = 'rgba(16, 185, 129, 0.1)';
            result.style.color = '#10b981';
            result.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            result.innerHTML = '<strong style="display:block;margin-bottom:4px;">✅ Sucesso</strong>' + (data.data || 'Mensagem enviada com sucesso!');
        } else {
            result.style.background = 'rgba(239, 68, 68, 0.1)';
            result.style.color = '#f87171';
            result.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            result.innerHTML = '<strong style="display:block;margin-bottom:4px;">❌ Erro</strong>' + (data.error || data.data || 'Falha ao enviar');
        }
    } catch (err) {
        result.style.display = 'block';
        result.style.background = 'rgba(239, 68, 68, 0.1)';
        result.style.color = '#f87171';
        result.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        result.innerHTML = '<strong style="display:block;margin-bottom:4px;">❌ Erro de Conexão</strong>' + err.message;
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}