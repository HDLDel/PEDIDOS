async function fetchStatus() {
            try {
                const res = await fetch('/api/whatsapp/status');
                const data = await res.json();
                updateUI(data);
            } catch (e) { console.error("Erro na API de status"); }
        }

        function updateUI(data) {
            const badge = document.getElementById('statusBadge');
            const title = document.getElementById('statusTitle');
            const desc = document.getElementById('statusDesc');
            const qrBox = document.getElementById('qrContainer');

            badge.className = 'status-badge status-' + data.status;
            badge.innerText = data.status.replace('_', ' ').toUpperCase();

            if (data.status === 'qr' && data.qr) {
                qrBox.innerHTML = `<img src="${data.qr}" alt="QR Code">`;
                title.innerText = "Escaneie agora";
                desc.innerText = "Abra o WhatsApp > Configurações > Dispositivos Conectados e aponte a câmera.";
            } else if (data.status === 'ready') {
                qrBox.innerHTML = `<i class="fas fa-check-circle" style="font-size: 8rem; color: #10b981;"></i>`;
                title.innerText = "Conectado!";
                desc.innerText = "Seu sistema está pronto para enviar as notificações automáticas.";
            } else if (data.status === 'loading' || data.status === 'authenticated') {
                qrBox.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size: 5rem; color: #3b82f6;"></i>`;
                title.innerText = "Autenticando...";
                desc.innerText = "Validando sessão e carregando mensagens. Por favor, aguarde.";
            } else {
                qrBox.innerHTML = `<i class="fas fa-robot" style="font-size: 5rem; color: #444;"></i>`;
                title.innerText = "Preparando...";
                desc.innerText = "O servidor está iniciando uma nova instância do navegador.";
            }
        }

        async function resetConnection() {
            if(!confirm("Deseja forçar o encerramento da sessão atual?")) return;
            document.getElementById('qrContainer').innerHTML = '<div style="color: #000;">Reiniciando...</div>';
            await fetch('/api/whatsapp/reset', { method: 'POST' });
        }

        async function logoutConnection() {
            if(!confirm("Deseja encerrar a sua sessão atual do WhatsApp?\n\nIsso removerá a conexão e você precisará ler o QR Code novamente.")) return;
            document.getElementById('qrContainer').innerHTML = '<div style="color: #000;"><i class="fas fa-spinner fa-spin"></i> Desconectando...</div>';
            await fetch('/api/whatsapp/reset', { method: 'POST' });
        }

        async function resendAllNotifications() {
            if(!confirm("Deseja reenviar a notificação dos ÚLTIMOS 50 pedidos processados? \n\nIsso rodará em segundo plano.")) return;
            try {
                const res = await fetch('/api/notifications/resend-all', { method: 'POST' });
                const data = await res.json();
                alert(data.message || 'Processo iniciado com sucesso!');
            } catch (e) { alert('Erro ao iniciar reenvio.'); }
        }

        setInterval(fetchStatus, 3000);
        fetchStatus();

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

        document.addEventListener('DOMContentLoaded', () => {
            const isLight = document.documentElement.classList.contains('light-theme');
            updateThemeIcon(isLight);
        });

// Expose functions globally for EJS onclick handlers
window.fetchStatus = fetchStatus;
window.updateUI = updateUI;
window.resetConnection = resetConnection;
window.logoutConnection = logoutConnection;
window.resendAllNotifications = resendAllNotifications;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;
