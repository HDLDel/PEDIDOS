document.getElementById('botbotForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.querySelector('.btn-save');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btn.disabled = true;

            const appKey = document.getElementById('appKey').value.trim();
            const authKey = document.getElementById('authKey').value.trim();

            try {
                const res = await fetch('/api/botbot/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appKey, authKey })
                });

                const data = await res.json();
                if (res.ok) {
                    alert(data.message);
                    atualizarStatus();
                } else {
                    alert(data.error || 'Erro ao salvar.');
                }
            } catch (err) {
                alert('Erro de conexão ao salvar.');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        document.getElementById('resendAllBtn').addEventListener('click', async () => {
            if(!confirm("Deseja reenviar a notificação dos ÚLTIMOS 50 pedidos processados? \n\nIsso pode demorar alguns minutos em segundo plano.")) return;
            
            const btn = document.getElementById('resendAllBtn');
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
        });

        document.getElementById('testBotBtn').addEventListener('click', async () => {
            const phone = document.getElementById('testPhone').value.trim();
            if (!phone) { alert('Informe o telefone para teste.'); return; }

            const btn = document.getElementById('testBotBtn');
            const result = document.getElementById('testResult');
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
        });

        function toggleTheme() {
            const isLight = document.documentElement.classList.toggle('light-theme');
            document.body.classList.toggle('light-theme', isLight);
            try {
                localStorage.setItem('theme', isLight ? 'light' : 'dark');
            } catch (e) {
                console.error('Falha ao salvar o tema:', e);
            }
            updateThemeIcon(isLight);
        }

        function updateThemeIcon(isLight) {
            const icon = document.getElementById('themeIcon');
            if (icon) {
                if (isLight) {
                    icon.className = 'fas fa-moon';
                    icon.style.color = '#374151';
                } else {
                    icon.className = 'fas fa-sun';
                    icon.style.color = '#f59e0b';
                }
            }
        }

        async function atualizarStatus() {
            try {
                const res = await fetch('/api/botbot/status');
                const data = await res.json();
                const badge = document.getElementById('statusBadge');
                if (data.status === 'ready') {
                    badge.className = 'status-badge status-ready';
                    badge.innerText = 'CONECTADO';
                    badge.title = '';
                } else {
                    badge.className = 'status-badge status-disconnected';
                    badge.innerText = 'DESCONECTADO';
                    badge.title = data.error || '';
                }
            } catch (e) {
                console.error('Erro ao buscar status:', e);
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            const isLight = document.documentElement.classList.contains('light-theme');
            updateThemeIcon(isLight);
            atualizarStatus();
        });

// Expose functions globally for EJS onclick handlers
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;
window.atualizarStatus = atualizarStatus;
