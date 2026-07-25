const pendingRequestsCount = parseInt(document.body.dataset.pendingCount || '0', 10);

        document.getElementById('btnSearch').addEventListener('click', async () => {
            const query = document.getElementById('tmdbSearch').value;
            if (query.length < 3) return alert('Digite pelo menos 3 caracteres');

            const resultsDiv = document.getElementById('tmdbResults');
            resultsDiv.innerHTML = '<div class="loader">Buscando...</div>';

            try {
                // Agora usamos nossa própria API interna
                const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
                const data = await res.json();
                
                resultsDiv.innerHTML = '';
                data.results.filter(i => i.media_type !== 'person').slice(0, 20).forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'tmdb-mini-card';
                    const title = item.title || item.name;
                    const date = item.release_date || item.first_air_date || '';
                    const fullDate = date ? date.split('-').reverse().join('/') : '';
                    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/200x300?text=Sem+Poster';

                    card.innerHTML = `
                        <img src="${poster}" alt="${title}">
                        <div class="info">
                            <h4>${title}</h4>
                            <span>Lançamento: ${fullDate}</span>
                        </div>
                    `;
                    card.onclick = () => {
                        const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
                        const releaseDate = item.release_date || item.first_air_date;
                        
                        if (releaseDate && releaseDate > today) {
                            alert(`⚠️ Pedido Bloqueado: Este conteúdo tem lançamento previsto para ${fullDate}. Não é permitido solicitar filmes ou séries que ainda não foram lançados oficialmente.`);
                            window.location.href = '/revenda/dashboard';
                            return;
                        }
                        selectWork(item, poster, title, fullDate || 'N/A');
                    };
                    resultsDiv.appendChild(card);
                });
            } catch (e) {
                resultsDiv.innerHTML = 'Erro ao buscar dados.';
            }
        });

        function selectWork(item, poster, title, year) {
            document.getElementById('tmdbResults').classList.add('hidden');
            document.getElementById('requestForm').classList.remove('hidden');
            
            const actionSelect = document.getElementById('requestAction');
            const isSeries = item.media_type === 'tv';

            // Lógica de filtragem do Menu (Dropdown)
            Array.from(actionSelect.options).forEach(opt => {
                const isSerieOption = (opt.value === 'season' || opt.value === 'episode');
                
                if (pendingRequestsCount >= 10) {
                    // Regra 1: Limite de pendentes (Sempre prioridade)
                    opt.style.display = (opt.value === 'error') ? 'block' : 'none';
                    opt.disabled = (opt.value !== 'error');
                } else if (!isSeries) {
                    // Regra 2: Se for FILME, esconde opções de temporada/episódio
                    opt.style.display = isSerieOption ? 'none' : 'block';
                    opt.disabled = isSerieOption;
                } else {
                    // Regra 3: Se for SÉRIE, mostra tudo
                    opt.style.display = 'block';
                    opt.disabled = false;
                }
            });

            // Ajusta o valor selecionado caso a opção atual tenha ficado inválida
            if (pendingRequestsCount >= 10) {
                actionSelect.value = 'error';
            } else if (!isSeries && (actionSelect.value === 'season' || actionSelect.value === 'episode')) {
                actionSelect.value = 'content';
            }

            // Alerta de limite se necessário
            if (pendingRequestsCount >= 10) {
                alert('⚠️ Limite de Pedidos: Como você já possui 10 solicitações pendentes, agora você só pode reportar erros de reprodução.');
            }

            document.getElementById('selectedId').value = item.id;
            document.getElementById('selectedTitle').value = title;
            document.getElementById('selectedType').value = item.media_type;
            document.getElementById('selectedPoster').value = poster;

            document.getElementById('previewPoster').src = poster;
            document.getElementById('previewTitle').innerText = title;
            document.getElementById('previewYear').innerText = year;

            updateUIByAction();
        }

        document.getElementById('requestAction').addEventListener('change', (e) => {
            updateUIByAction();
        });

        function updateUIByAction() {
            const action = document.getElementById('requestAction').value;
            const type = document.getElementById('selectedType').value;
            const isSeries = (type === 'tv' || type === 'series');
            const isError = action === 'error';

            // Mostrar campos de erro
            document.getElementById('errorField').classList.toggle('hidden', !isError);
            
            const extraFields = document.getElementById('extraFields');
            const seasonGroup = document.getElementById('reqSeasonDigit1').closest('.form-group');
            const episodeGroup = document.getElementById('reqEpisodeDigit1').closest('.form-group');

            const resetSeasonDigits = () => {
                document.getElementById('reqSeasonDigit1').value = '';
                document.getElementById('reqSeasonDigit2').value = '';
            };
            const resetEpisodeDigits = () => {
                document.getElementById('reqEpisodeDigit1').value = '';
                document.getElementById('reqEpisodeDigit2').value = '';
                document.getElementById('reqEpisodeDigit3').value = '';
            };

            if (isSeries && !isError) {
                if (action === 'content') {
                    extraFields.classList.add('hidden');
                    resetSeasonDigits();
                    resetEpisodeDigits();
                } else if (action === 'season') {
                    extraFields.classList.remove('hidden');
                    seasonGroup.classList.remove('hidden');
                    episodeGroup.classList.add('hidden');
                    resetEpisodeDigits();
                } else {
                    extraFields.classList.remove('hidden');
                    seasonGroup.classList.remove('hidden');
                    episodeGroup.classList.remove('hidden');
                }
            } else {
                extraFields.classList.add('hidden');
                resetSeasonDigits();
                resetEpisodeDigits();
            }

            if (!isError) {
                document.getElementById('reqDescription').value = '';
            }

            // Controle das labels de obrigatoriedade
            document.getElementById('labelSeasonReq').classList.toggle('hidden', action !== 'season');
            document.getElementById('labelEpisodeReq').classList.toggle('hidden', action !== 'episode');

            validateForm();
        }

        function validateForm() {
            const action = document.getElementById('requestAction').value;
            const btnSubmit = document.querySelector('.btn-submit');
            let isValid = true;

            const s1 = document.getElementById('reqSeasonDigit1').value;
            const s2 = document.getElementById('reqSeasonDigit2').value;
            const seasonVal = (s1 + s2).trim();

            const e1 = document.getElementById('reqEpisodeDigit1').value;
            const e2 = document.getElementById('reqEpisodeDigit2').value;
            const e3 = document.getElementById('reqEpisodeDigit3').value;
            const episodeVal = (e1 + e2 + e3).trim();

            if (action === 'error') {
                const desc = document.getElementById('reqDescription').value.trim();
                if (desc.length < 10) isValid = false;
            } else if (action === 'season') {
                if (seasonVal.length === 0) isValid = false;
            } else if (action === 'episode') {
                if (seasonVal.length === 0 || episodeVal.length === 0) isValid = false;
            }

            btnSubmit.disabled = !isValid;
        }

        document.getElementById('reqDescription').addEventListener('input', validateForm);
        document.getElementById('reqSeasonDigit1').addEventListener('change', validateForm);
        document.getElementById('reqSeasonDigit2').addEventListener('change', validateForm);
        document.getElementById('reqEpisodeDigit1').addEventListener('change', validateForm);
        document.getElementById('reqEpisodeDigit2').addEventListener('change', validateForm);
        document.getElementById('reqEpisodeDigit3').addEventListener('change', validateForm);

        function resetForm() {
            document.getElementById('requestForm').classList.add('hidden');
            document.getElementById('tmdbResults').classList.remove('hidden');
            document.getElementById('tmdbSearch').value = '';
            document.getElementById('reqSeasonDigit1').value = '';
            document.getElementById('reqSeasonDigit2').value = '';
            document.getElementById('reqEpisodeDigit1').value = '';
            document.getElementById('reqEpisodeDigit2').value = '';
            document.getElementById('reqEpisodeDigit3').value = '';
        }

        document.getElementById('requestForm').onsubmit = async (e) => {
            e.preventDefault();
            
            const s1 = document.getElementById('reqSeasonDigit1').value;
            const s2 = document.getElementById('reqSeasonDigit2').value;
            const seasonVal = (s1 + s2).trim();

            const e1 = document.getElementById('reqEpisodeDigit1').value;
            const e2 = document.getElementById('reqEpisodeDigit2').value;
            const e3 = document.getElementById('reqEpisodeDigit3').value;
            const episodeVal = (e1 + e2 + e3).trim();

            const payload = {
                tmdbId: document.getElementById('selectedId').value,
                title: document.getElementById('selectedTitle').value,
                type: document.getElementById('selectedType').value === 'tv' ? 'series' : 'movie',
                requestType: document.getElementById('requestAction').value,
                season: seasonVal || null,
                episode: episodeVal || null,
                description: document.getElementById('reqDescription').value,
                date: new Date().toLocaleDateString('pt-BR'),
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                audioPreference: document.querySelector('input[name="audioPreference"]:checked').value
            };

            try {
                const res = await fetch('/api/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    alert('Pedido enviado com sucesso!');
                    window.location.href = '/revenda/dashboard';
                } else {
                    const data = await res.json();
                    alert(data.error || 'Erro ao enviar pedido.');
                    
                    // Se for erro de duplicidade (409), redireciona para a dashboard
                    if (res.status === 409) {
                        window.location.href = '/revenda/dashboard';
                    }
                }
            } catch (err) {
                alert('Erro ao enviar pedido.');
            }
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
window.selectWork = selectWork;
window.updateUIByAction = updateUIByAction;
window.validateForm = validateForm;
window.resetForm = resetForm;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;
