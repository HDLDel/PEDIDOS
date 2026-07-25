function openEditModal(data) {
            document.getElementById('edit-id').value = data.id;
            document.getElementById('edit-name').value = data.name;
            document.getElementById('edit-email').value = data.email;
            document.getElementById('edit-phone').value = data.phone;
            document.getElementById('edit-whatsapp').value = data.whatsapp;
            document.getElementById('edit-password').value = data.password;
            document.getElementById('editModal').style.display = 'flex';
        }

        function closeEditModal() {
            document.getElementById('editModal').style.display = 'none';
        }

        async function clearRequests(id, name) {
            if (!confirm(`Deseja apagar TODOS os pedidos de ${name}?\nEsta ação não pode ser desfeita.`)) return;
            try {
                const res = await fetch(`/api/resellers/${id}/requests`, { method: 'DELETE' });
                if (res.ok) { location.reload(); } else { alert('Erro ao limpar pedidos.'); }
            } catch (e) { alert('Erro na comunicação.'); }
        }

        async function clearAllRequests() {
            if (!confirm("ATENÇÃO: Deseja apagar TODOS os pedidos de TODOS os revendedores?\nEsta ação é irreversível!")) return;
            if (!confirm("Tem certeza absoluta? Isso limpará toda a base de pedidos.")) return;
            
            try {
                const res = await fetch('/api/requests/all', { method: 'DELETE' });
                if (res.ok) {
                    location.reload();
                } else {
                    alert('Erro ao limpar todos os pedidos.');
                }
            } catch (e) {
                alert('Erro na comunicação com o servidor.');
            }
        }

        async function deleteReseller(id, name) {
            if (!confirm(`Deseja REALMENTE excluir o revendedor ${name}?\nIsso apagará permanentemente o acesso dele.`)) return;

            try {
                const res = await fetch(`/api/resellers/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    document.getElementById(`reseller-${id}`).remove();
                } else {
                    alert('Erro ao excluir revendedor.');
                }
            } catch (e) {
                alert('Erro na comunicação com o servidor.');
            }
        }

        document.getElementById('editForm').onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const payload = {
                name: document.getElementById('edit-name').value,
                email: document.getElementById('edit-email').value,
                phone: document.getElementById('edit-phone').value,
                whatsapp: document.getElementById('edit-whatsapp').value,
                password: document.getElementById('edit-password').value
            };

            try {
                const res = await fetch(`/api/resellers/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    location.reload();
                } else {
                    alert('Erro ao atualizar dados.');
                }
            } catch (e) { alert('Erro na comunicação.'); }
        };

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
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.clearRequests = clearRequests;
window.clearAllRequests = clearAllRequests;
window.deleteReseller = deleteReseller;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;
