let localRejectionReasons = document.body.dataset.rejectionReasons ? JSON.parse(document.body.dataset.rejectionReasons) : [];
const requestIdToCardIdMap = new Map();

function initRequestIdMap() {
    requestIdToCardIdMap.clear();
    document.querySelectorAll('.request-card').forEach(card => {
        const cardId = parseInt(card.dataset.id);
        if (!isNaN(cardId)) {
            requestIdToCardIdMap.set(cardId, cardId);
        }
        const detailsBtn = card.querySelector('[data-details]');
        if (detailsBtn) {
            try {
                const details = JSON.parse(decodeURIComponent(detailsBtn.dataset.details));
                details.forEach(sub => {
                    requestIdToCardIdMap.set(sub.id, cardId);
                });
            } catch (e) {
                console.error('Error parsing details for card ' + cardId, e);
            }
        }
    });
}

let currentRequestId = null;
let currentRequestType = null; // Para armazenar o tipo (movie/series)
let currentSyncAll = true;
let activeCategory = 'all';
let activeStatus = 'pending';
let checkStatusInterval = null;

async function startM3uSyncHeader() {
    const btn = document.getElementById('m3uSyncBtn');
    const btnText = btn.querySelector('span');
    const btnIcon = btn.querySelector('i');
    
    if (btn.disabled) return;
    
    if (!confirm('Deseja iniciar a sincronização da Playlist M3U agora?')) return;
    
    btn.disabled = true;
    btnText.innerText = 'SINCRONIZANDO...';
    btnIcon.className = 'fas fa-spinner fa-spin';
    
    try {
        const resStatus = await fetch('/api/m3u/status');
        const dataStatus = await resStatus.json();
        
        if (!dataStatus.success || !dataStatus.source) {
            alert('Nenhuma URL de Playlist M3U configurada! Por favor, configure primeiro no menu de Configurações.');
            btn.disabled = false;
            btnText.innerText = 'M3U';
            btnIcon.className = 'fas fa-list-ul';
            return;
        }
        
        const source = dataStatus.source;
        
        const resSync = await fetch('/api/m3u/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source })
        });
        
        const dataSync = await resSync.json();
        if (dataSync.success) {
            alert('Sincronização M3U concluída com sucesso! A página será recarregada.');
            location.reload();
        } else {
            alert('Erro na sincronização: ' + (dataSync.error || 'Erro desconhecido'));
            btn.disabled = false;
            btnText.innerText = 'M3U';
            btnIcon.className = 'fas fa-list-ul';
        }
    } catch (err) {
        alert('Falha na comunicação com o servidor: ' + err.message);
        btn.disabled = false;
        btnText.innerText = 'M3U';
        btnIcon.className = 'fas fa-list-ul';
    }
}

// Modal de detalhes M3U
function closeM3uDetailsModal() {
    document.getElementById('m3uDetailsModal').style.display = 'none';
}

async function showM3uDetails(el) {
    const card = el.closest('.request-card');
    const normalized = card.dataset.m3uNormalized;
    const type = card.dataset.m3uType;

    if (!normalized) return;

    const modal = document.getElementById('m3uDetailsModal');
    const loading = document.getElementById('m3uDetailsLoading');
    const content = document.getElementById('m3uDetailsContent');

    modal.style.display = 'flex';
    loading.style.display = 'block';
    content.style.display = 'none';
    document.getElementById('m3uDetailsTitle').innerText = 'Carregando...';

    let titleData = null;
    let titleErr = null;

    // Buscar título na M3U (com timeout e validação de resposta)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const titleRes = await fetch(`/api/m3u/title?normalized=${encodeURIComponent(normalized)}&type=${encodeURIComponent(type)}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!titleRes.ok) {
            const text = await titleRes.text();
            throw new Error(`Resposta ${titleRes.status} do servidor`);
        }
        const ct = titleRes.headers.get('content-type') || '';
        if (!ct.includes('json')) {
            const text = await titleRes.text();
            console.error('M3U title: resposta não-JSON', titleRes.status, text.substring(0, 300));
            throw new Error(`Resposta não-JSON (${titleRes.status})`);
        }
        titleData = await titleRes.json();
    } catch (e) {
        titleErr = e;
        console.error('Erro ao buscar título M3U:', e);
    }

    let html = '';

    // Banners M3U (centralizados no topo)
    if (titleData && titleData.logos && titleData.logos.length > 0) {
        html += `<div style="text-align:center;margin-bottom:14px;display:flex;justify-content:center;gap:8px;">`;
        for (const logo of titleData.logos) {
            html += `<img src="/api/m3u/logo?url=${encodeURIComponent(logo.logoUrl)}" style="width:80px;height:80px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);object-fit:cover;box-shadow:0 2px 10px rgba(0,0,0,0.5);" title="${logo.title}" onerror="this.style.display='none'">`;
        }
        html += `</div>`;
    }

    // Título
    if (titleData) {
        let titleHtml = `<div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px;">TÍTULO NA PLAYLIST M3U</div>`;
        if (titleData.titles && titleData.titles.length > 0) {
            for (const t of titleData.titles) {
                titleHtml += `<div style="padding:5px 0;${t !== titleData.titles[titleData.titles.length - 1] ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}font-size:0.9rem;color:#fff;font-weight:500;">🎬 ${t.title}${t.year ? ` (${t.year})` : ''}</div>`;
            }
        } else {
            titleHtml += `<div style="font-size:1rem;color:#fff;font-weight:600;">${titleData.title || 'N/A'}</div>`;
        }
        html += `<div style="background: #0d0d0d; border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 12px;">${titleHtml}</div>`;
    }

    // Episódios (even if title fetch failed)
    if (type === 'series') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const epRes = await fetch(`/api/m3u/episodes?normalized=${encodeURIComponent(normalized)}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!epRes.ok) {
                const text = await epRes.text();
                throw new Error(`Resposta ${epRes.status} do servidor`);
            }
            const ct = epRes.headers.get('content-type') || '';
            if (!ct.includes('json')) {
                const text = await epRes.text();
                console.error('M3U episodes: resposta não-JSON', epRes.status, text.substring(0, 300));
                throw new Error(`Resposta não-JSON (${epRes.status})`);
            }
            const episodes = await epRes.json();

            if (episodes && episodes.length > 0) {
                // Agrupar por temporada
                const seasons = {};
                for (const ep of episodes) {
                    const s = ep.season || 0;
                    if (!seasons[s]) seasons[s] = [];
                    seasons[s].push(ep);
                }

                const seasonKeys = Object.keys(seasons).sort((a, b) => parseInt(a) - parseInt(b));
                html += `<div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; margin-bottom: 8px;">EPISÓDIOS DISPONÍVEIS</div>`;

                for (const sk of seasonKeys) {
                    const eps = seasons[sk];
                    html += `<div style="background: #0d0d0d; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; overflow: hidden;">
                        <div style="padding: 8px 12px; background: rgba(255,255,255,0.03); font-weight: 700; color: #10b981; font-size: 0.85rem;">
                            <i class="fas fa-film" style="margin-right: 6px;"></i> Temporada ${sk}
                            <span style="color: #888; font-weight: 400; margin-left: 6px;">(${eps.length} episódio${eps.length !== 1 ? 's' : ''})</span>
                        </div>
                        <div style="padding: 4px 12px 8px;">`;

                    for (const ep of eps) {
                        html += `<div style="padding: 4px 0; font-size: 0.8rem; color: #ccc; display: flex; align-items: center; gap: 8px;">
                            <span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; min-width: 48px; text-align: center;">S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}</span>
                            <span>${ep.episode_label}</span>
                        </div>`;
                    }

                    html += `</div></div>`;
                }
            } else {
                html += `<div style="background: #0d0d0d; border: 1px solid var(--border); padding: 20px; border-radius: 8px; text-align: center; color: #888;">
                    <i class="fas fa-info-circle" style="margin-right: 6px;"></i> Nenhum episódio detalhado disponível para esta série.
                </div>`;
            }
        } catch (e) {
            console.error('Erro ao buscar episódios M3U:', e);
            html += `<div style="background: #0d0d0d; border: 1px solid var(--border); padding: 20px; border-radius: 8px; text-align: center; color: #f87171;">
                <i class="fas fa-exclamation-triangle" style="margin-right: 6px;"></i> Erro ao carregar episódios: ${e.message}
            </div>`;
        }
    } else {
        html += `<div style="background: #0d0d0d; border: 1px solid var(--border); padding: 20px; border-radius: 8px; text-align: center; color: #888;">
            <i class="fas fa-film" style="margin-right: 6px;"></i> Filme disponível na playlist M3U.
        </div>`;
    }

    content.innerHTML = html;
    loading.style.display = 'none';
    content.style.display = 'block';
    document.getElementById('m3uDetailsTitle').innerText = titleData ? titleData.title : (titleErr ? 'Erro parcial' : 'Dados da M3U');
}

async function checkWaStatus() {
    try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        const btn = document.getElementById('waStatusBtn');
        const btnText = btn.querySelector('span');

        btn.className = 'whatsapp-status-btn ' + (data.status === 'ready' ? 'wa-on' : (data.status === 'qr' ? 'wa-qr' : 'wa-off'));
        btnText.innerText = data.status.toUpperCase();

        // Atualiza a tela de configuração interna do WhatsApp se a seção estiver aberta
        const waConfigSection = document.getElementById('whatsappConfigSection');
        if (waConfigSection && waConfigSection.classList.contains('open')) {
            const configBadge = document.getElementById('waConfigStatusBadge');
            const configDesc = document.getElementById('waConfigStatusDesc');
            const configQrBox = document.getElementById('waConfigQrContainer');

            if (configBadge) {
                configBadge.className = 'status-badge status-' + data.status;
                configBadge.innerText = data.status.replace('_', ' ').toUpperCase();
            }

            if (configDesc && configQrBox) {
                if (data.status === 'qr' && data.qr) {
                    configQrBox.innerHTML = `<img src="${data.qr}" alt="QR Code" style="width: 170px; height: 170px; display: block; margin: 0 auto;">`;
                    configDesc.innerText = "Abra o WhatsApp > Configurações > Dispositivos Conectados e aponte a câmera.";
                } else if (data.status === 'ready') {
                    configQrBox.innerHTML = `<i class="fas fa-check-circle" style="font-size: 5rem; color: #10b981;"></i>`;
                    configDesc.innerText = "Seu sistema está pronto para enviar as notificações automáticas.";
                } else if (data.status === 'loading' || data.status === 'authenticated') {
                    configQrBox.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size: 3.5rem; color: #3b82f6;"></i>`;
                    configDesc.innerText = "Validando sessão e carregando mensagens. Por favor, aguarde.";
                } else {
                    configQrBox.innerHTML = `<i class="fas fa-robot" style="font-size: 3.5rem; color: #444;"></i>`;
                    configDesc.innerText = "O servidor está iniciando uma nova instância do navegador.";
                }
            }
        }

        const resBb = await fetch('/api/botbot/status');
        const dataBb = await resBb.json();
        const bbBtn = document.getElementById('bbStatusBtn');
        const bbBtnText = bbBtn.querySelector('span');
        const isReady = dataBb.status === 'ready';
        bbBtn.className = 'whatsapp-status-btn ' + (isReady ? 'wa-on' : 'wa-off');
        bbBtnText.innerText = isReady ? 'ONLINE' : 'OFFLINE';
        if (dataBb.error) {
            bbBtn.title = dataBb.error;
        } else {
            bbBtn.title = isReady ? 'BotBot conectado' : 'Status desconhecido';
        }

        // Atualiza a tela de configuração interna do BotBot
        const bbConfigBadge = document.getElementById('bbConfigStatusBadge');
        if (bbConfigBadge) {
            if (isReady) {
                bbConfigBadge.className = 'status-badge status-ready';
                bbConfigBadge.innerText = 'CONECTADO';
                bbConfigBadge.title = '';
            } else {
                bbConfigBadge.className = 'status-badge status-disconnected';
                bbConfigBadge.innerText = dataBb.status === 'disconnected' && (!dataBb.error || dataBb.error.includes('Aguardando chaves')) ? 'AGUARDANDO CHAVES' : 'DESCONECTADO';
                bbConfigBadge.title = dataBb.error || '';
            }
        }
    } catch (e) {
        console.error("Erro ao verificar status das APIs:", e);
    }
}

setInterval(checkWaStatus, 5000); // Atualiza status a cada 5 segundos

let debounceTimer = null;
function debouncedApplyFilters() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        applyFilters();
    }, 300);
}

function updateCardDisplayForStatus(card, status) {
    const allRequests = JSON.parse(decodeURIComponent(card.dataset.allRequests));
    
    // Determine filtered list of requests
    let filteredRequests = [];
    if (status === 'approved') {
        filteredRequests = allRequests.filter(r => r.status === 'approved');
    } else if (status === 'rejected') {
        filteredRequests = allRequests.filter(r => r.status === 'rejected');
    } else {
        // For pending, all, and other cases, show complete history
        filteredRequests = allRequests;
    }

    // 1. Update main status badge
    const mainReq = filteredRequests[0] || allRequests[0];
    const badgeStatus = card.querySelector('.badge-status');
    if (badgeStatus) {
        badgeStatus.className = `badge-status status-${mainReq.status}`;
        badgeStatus.innerText = mainReq.status === 'pending' ? 'Pendente' : (mainReq.status === 'approved' ? 'Aprovado' : 'Rejeitado');
    }

    // 2. Update grouped badge
    const badgeGrouped = card.querySelector('.badge-grouped');
    if (badgeGrouped) {
        if (filteredRequests.length > 1) {
            badgeGrouped.style.display = 'block';
            const textSpan = badgeGrouped.querySelector('.badge-grouped-text');
            if (textSpan) {
                textSpan.innerText = `${filteredRequests.length} AGRUPADOS`;
            }
            const pendingSpan = badgeGrouped.querySelector('.badge-grouped-pending');
            if (pendingSpan) {
                const pendingCount = filteredRequests.filter(r => r.status === 'pending').length;
                if (pendingCount > 0) {
                    pendingSpan.style.display = 'inline-block';
                    pendingSpan.innerText = pendingCount;
                } else {
                    pendingSpan.style.display = 'none';
                }
            }
        } else {
            badgeGrouped.style.display = 'none';
        }
    }

    // 3. Update audio/error badges
    const countDub = filteredRequests.filter(r => r.audioPreference === 'Dublado' && r.requestType !== 'error').length;
    const countLeg = filteredRequests.filter(r => r.audioPreference === 'Legendado' && r.requestType !== 'error').length;
    const countErr = filteredRequests.filter(r => r.requestType === 'error').length;

    const badgeDub = card.querySelector('.badge-dub');
    if (badgeDub) {
        if (countDub > 0) {
            badgeDub.style.display = 'inline-block';
            badgeDub.querySelector('.count-value').innerText = countDub;
        } else {
            badgeDub.style.display = 'none';
        }
    }
    const badgeLeg = card.querySelector('.badge-leg');
    if (badgeLeg) {
        if (countLeg > 0) {
            badgeLeg.style.display = 'inline-block';
            badgeLeg.querySelector('.count-value').innerText = countLeg;
        } else {
            badgeLeg.style.display = 'none';
        }
    }
    const badgeErr = card.querySelector('.badge-err');
    if (badgeErr) {
        if (countErr > 0) {
            badgeErr.style.display = 'inline-block';
            badgeErr.querySelector('.count-value').innerText = countErr;
        } else {
            badgeErr.style.display = 'none';
        }
    }

    // 4. Update details action button
    const detailsBtn = card.querySelector('.btn-details-action');
    if (detailsBtn) {
        detailsBtn.dataset.details = encodeURIComponent(JSON.stringify(filteredRequests));
        if (filteredRequests.length > 1) {
            detailsBtn.style.background = 'rgba(59, 130, 246, 0.08)';
            detailsBtn.style.color = '#60a5fa';
            detailsBtn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            detailsBtn.innerHTML = `<i class="fas fa-list"></i> Histórico de Pedidos`;
        } else {
            detailsBtn.style.background = 'rgba(245, 158, 11, 0.08)';
            detailsBtn.style.color = '#fbbf24';
            detailsBtn.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            detailsBtn.innerHTML = `<i class="fas fa-cog"></i> Opções do Pedido`;
        }
    }

    // 5. Update Chat / Conversa button
    const chatBtn = card.querySelector('.btn-chat-history');
    if (chatBtn) {
        const chatRequests = filteredRequests.filter(r => r.rejectionReason || r.description);
        if (chatRequests.length > 0) {
            chatBtn.style.display = 'flex';
            // Build combined chat description from filtered requests
            let combinedChatDesc = '';
            chatRequests.forEach(req => {
                let desc = req.description || '';
                if (req.rejectionReason && !desc.includes('[Rejeitado pelo Admin')) {
                    desc = (desc ? desc + '\n' : '') + `[Rejeitado pelo Admin - Motivo: ${req.rejectionReason}]`;
                }
                if (desc) {
                    combinedChatDesc += (combinedChatDesc ? '\n\n' : '') + desc;
                }
            });
            
            const titleEsc = encodeURIComponent(mainReq.title || '').replace(/'/g, "%27");
            const descEsc = encodeURIComponent(combinedChatDesc).replace(/'/g, "%27");
            chatBtn.onclick = () => openChatModal(titleEsc, descEsc);
        } else {
            chatBtn.style.display = 'none';
        }
    }

    // 6. Update Approve/Reject button group
    const approvalGroup = card.querySelector('.approval-btn-group');
    if (approvalGroup) {
        const pendingRequests = filteredRequests.filter(r => r.status === 'pending');
        if (pendingRequests.length > 0) {
            approvalGroup.style.display = 'grid';
            const approveBtn = approvalGroup.querySelector('.btn-approve');
            const rejectBtn = approvalGroup.querySelector('.btn-reject');
            const isMultiplePending = pendingRequests.length > 1;
            
            if (approveBtn) {
                approveBtn.innerText = isMultiplePending ? 'Aprovar Pendentes' : 'Aprovar';
                approveBtn.onclick = () => updateStatus(mainReq.id, 'approved', null, isMultiplePending);
            }
            if (rejectBtn) {
                rejectBtn.innerText = isMultiplePending ? 'Rejeitar Pendentes' : 'Rejeitar';
                rejectBtn.onclick = () => openRejectModal(mainReq.id, mainReq.type, isMultiplePending);
            }
        } else {
            approvalGroup.style.display = 'none';
        }
    }
}

function applyFilters() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    const m3uFilter = document.getElementById('m3uFilterSelect').value;

    let countAll = 0;
    let countSeries = 0;
    let countMovie = 0;
    let countError = 0;

    document.querySelectorAll('.request-card').forEach(card => {
        const categoryMatch = activeCategory === 'all' || card.dataset.category === activeCategory;
        
        const cardStatuses = card.dataset.statuses.split(',');
        const statusMatch = activeStatus === 'all' || cardStatuses.includes(activeStatus);

        const titleMatch = card.dataset.title.includes(searchQuery);
        const resellerMatch = card.dataset.reseller.includes(searchQuery);
        const searchMatch = !searchQuery || titleMatch || resellerMatch;

        const m3uMatch = m3uFilter === 'all' ||
            (m3uFilter === 'present' && card.dataset.inM3u === 'true') ||
            (m3uFilter === 'absent' && card.dataset.inM3u === 'false');

        const isVisible = categoryMatch && statusMatch && searchMatch && m3uMatch;
        if (isVisible) {
            card.classList.remove('hidden');
            updateCardDisplayForStatus(card, activeStatus);
        } else {
            card.classList.add('hidden');
        }

        if (statusMatch && searchMatch) {
            countAll++;
            if (card.dataset.category === 'series') countSeries++;
            else if (card.dataset.category === 'movie') countMovie++;
            else if (card.dataset.category === 'error') countError++;
        }
    });

    document.getElementById('count-all').innerText = countAll;
    document.getElementById('count-series').innerText = countSeries;
    document.getElementById('count-movie').innerText = countMovie;
    document.getElementById('count-error').innerText = countError;
}

function sortCards() {
    const grid = document.querySelector('.requests-grid');
    const cards = Array.from(grid.querySelectorAll('.request-card'));
    const sortType = document.getElementById('sortSelect').value;

    const getYear = (dateStr) => {
        if (!dateStr || dateStr === '0') return 0;
        const parts = dateStr.split('/');
        return parts.length === 3 ? parseInt(parts[2]) : parseInt(dateStr) || 0;
    };

    cards.sort((a, b) => {
        if (sortType === 'newest') return parseInt(b.dataset.id) - parseInt(a.dataset.id);
        if (sortType === 'oldest') return parseInt(a.dataset.id) - parseInt(b.dataset.id);
        if (sortType === 'yearDesc') return getYear(b.dataset.year) - getYear(a.dataset.year);
        if (sortType === 'yearAsc') return getYear(a.dataset.year) - getYear(b.dataset.year);
        if (sortType === 'resellerAsc') return a.dataset.reseller.localeCompare(b.dataset.reseller);
        if (sortType === 'resellerDesc') return b.dataset.reseller.localeCompare(a.dataset.reseller);
    });

    // Re-anexa os cards na nova ordem (o navegador move os elementos automaticamente)
    cards.forEach(card => grid.appendChild(card));
}

function filterCategory(category) {
    activeCategory = category;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${category}`).classList.add('active');
    applyFilters();
}

function filterStatus(status) {
    activeStatus = status;
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
    document.getElementById(`stat-${status}`).classList.add('active');
    applyFilters();
}

async function refreshStats() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        document.querySelector('#stat-pending strong').innerText = stats.pending;
        document.querySelector('#stat-approved strong').innerText = stats.approved;
        document.querySelector('#stat-rejected strong').innerText = stats.rejected;
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

function openRejectModal(id, type, syncAll = true) {
    currentRequestId = id;
    currentRequestType = type;
    currentSyncAll = syncAll;
    document.getElementById('rejectModal').style.display = 'flex';
    document.getElementById('rejectionText').value = '';
}

function closeRejectModal() {
    document.getElementById('rejectModal').style.display = 'none';
    currentRequestId = null;
    currentRequestType = null;
}

function openDetailsModal(encodedData) {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const header = document.querySelector('#detailsModal .modal-header');
    if (header) {
        header.innerHTML = data.length > 1 ? '📦 Histórico de Pedidos Agrupados' : '⚙️ Opções do Pedido';
    }
    const tbody = document.getElementById('detailsTableBody');
    tbody.innerHTML = '';

    data.forEach(req => {
        let cleanDesc = req.description || '';
        if (cleanDesc && (cleanDesc.includes('[Rejeitado pelo Admin') || cleanDesc.includes('[Resposta do Revendedor'))) {
            const idx = cleanDesc.search(/\[Rejeitado pelo Admin|\[Resposta do Revendedor/);
            if (idx !== -1) {
                cleanDesc = cleanDesc.substring(0, idx).trim();
            }
        }

        let extraInfo = '';
        if (req.season) extraInfo += `T${req.season} `;
        if (req.episode) extraInfo += `E${req.episode} `;
        if (req.audioPreference && req.requestType !== 'error') extraInfo += `🎤 ${req.audioPreference} `;
        if (cleanDesc) extraInfo += `<br><span style="color: #bbb; font-size: 0.8rem;"><i class="far fa-comment-dots"></i> ${cleanDesc}</span>`;
        else if (req.requestType === 'error') extraInfo += `<br>⚠️ Erro reportado`;

        let actionsHtml = '';
        const hasChat = !!(req.rejectionReason || req.description);
        let chatDesc = req.description || '';
        if (req.rejectionReason && !chatDesc.includes('[Rejeitado pelo Admin')) {
            chatDesc = (chatDesc ? chatDesc + '\n' : '') + `[Rejeitado pelo Admin - Motivo: ${req.rejectionReason}]`;
        }

        if (req.status === 'pending') {
            actionsHtml = `
                <div style="display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;">
                    <button class="btn btn-approve" style="background: transparent; border: 1px solid var(--status-approved); color: var(--status-approved); padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s;" 
                            onmouseover="this.style.background='var(--status-approved)'; this.style.color='white';" 
                            onmouseout="this.style.background='transparent'; this.style.color='var(--status-approved)';"
                            onclick="updateStatus(${req.id}, 'approved', null, false)">
                        <i class="fas fa-check"></i> Aprovar
                    </button>
                    <button class="btn btn-reject" style="background: transparent; border: 1px solid var(--status-rejected); color: var(--status-rejected); padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s;" 
                            onmouseover="this.style.background='var(--status-rejected)'; this.style.color='white';" 
                            onmouseout="this.style.background='transparent'; this.style.color='var(--status-rejected)';"
                            onclick="openRejectModal(${req.id}, '${req.type}', false)">
                        <i class="fas fa-times"></i> Rejeitar
                    </button>
                    ${hasChat ? `
                    <button class="btn" style="background: rgba(37, 99, 235, 0.15); border: 1px solid #2563eb; color: #3b82f6; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" 
                            onmouseover="this.style.background='#2563eb'; this.style.color='white';"
                            onmouseout="this.style.background='rgba(37, 99, 235, 0.15)'; this.style.color='#3b82f6';"
                            onclick="openChatModal('${encodeURIComponent(req.title).replace(/'/g, "%27")}', '${encodeURIComponent(chatDesc).replace(/'/g, "%27")}')">
                        <i class="fas fa-comment-dots"></i>
                    </button>
                    ` : ''}
                    <button class="btn" style="background: #222; border: 1px solid #444; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: 0.2s;" 
                            onmouseover="this.style.background='#333';"
                            onmouseout="this.style.background='#222';"
                            onclick="openOptionsModal(${req.id}, '${req.type}', '${req.status}', '${encodeURIComponent(req.title).replace(/'/g, "%27")}', '${encodeURIComponent(req.reseller).replace(/'/g, "%27")}', false)">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            `;
        } else {
            const badgeText = req.status === 'approved' ? 'Aprovado' : 'Rejeitado';
            actionsHtml = `
                <div style="display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;">
                    <span class="badge-status status-${req.status}" style="position: static; padding: 5px 8px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${badgeText}</span>
                    ${hasChat ? `
                    <button class="btn" style="background: rgba(37, 99, 235, 0.15); border: 1px solid #2563eb; color: #3b82f6; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" 
                            onmouseover="this.style.background='#2563eb'; this.style.color='white';"
                            onmouseout="this.style.background='rgba(37, 99, 235, 0.15)'; this.style.color='#3b82f6';"
                            onclick="openChatModal('${encodeURIComponent(req.title).replace(/'/g, "%27")}', '${encodeURIComponent(chatDesc).replace(/'/g, "%27")}')">
                        <i class="fas fa-comment-dots"></i>
                    </button>
                    ` : ''}
                    <button class="btn" style="background: #222; border: 1px solid #444; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: 0.2s;" 
                            onmouseover="this.style.background='#333';"
                            onmouseout="this.style.background='#222';"
                            onclick="openOptionsModal(${req.id}, '${req.type}', '${req.status}', '${encodeURIComponent(req.title).replace(/'/g, "%27")}', '${encodeURIComponent(req.reseller).replace(/'/g, "%27")}', false)">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            `;
        }

        tbody.innerHTML += `
            <tr id="modal-row-${req.id}" style="border-bottom: 1px solid #222; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                <td data-label="Revendedor" style="padding: 12px 15px; color: #fff; font-weight: 600;">${req.reseller}</td>
                <td data-label="Ação" style="padding: 12px 15px; color: #fff;">${req.action}</td>
                <td data-label="Detalhes" style="padding: 12px 15px; color: var(--text-muted);">${extraInfo || '-'}</td>
                <td data-label="Data" style="padding: 12px 15px; color: var(--text-muted);">${req.date} ${req.time}</td>
                <td data-label="Ações" style="padding: 12px 15px; display: flex; gap: 8px; justify-content: center; align-items: center;">${actionsHtml}</td>
            </tr>
        `;
    });

    document.getElementById('detailsModal').style.display = 'flex';
}

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

function setReason(id) {
    const reason = localRejectionReasons.find(r => String(r.id) === String(id));
    const reasonText = reason ? reason.template : '';
    document.getElementById('rejectionText').value = reasonText;
}

document.getElementById('confirmRejectBtn').onclick = () => {
    const reason = document.getElementById('rejectionText').value;
    if (!reason) return alert('Por favor, informe um motivo.');
    updateStatus(currentRequestId, 'rejected', reason, currentSyncAll);
    closeRejectModal();
};

async function updateStatus(id, status, reason = null, syncAll = true) {
    if (!reason && !confirm(`Deseja realmente alterar o status para ${status.toUpperCase()}?`)) return;

    try {
        const response = await fetch(`/api/requests/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, rejectionReason: reason, syncAll })
        });

        if (response.ok) {
            const reqData = await response.json(); // Recebe o objeto do banco de dados atualizado

            // Encontrar o card correspondente ao id da request atualizado
            const targetCardId = requestIdToCardIdMap.get(id);
            if (targetCardId) {
                const card = document.getElementById(`card-${targetCardId}`);
                if (card) {
                    // Carregar todas as requisições associadas a este card
                    const allRequests = JSON.parse(decodeURIComponent(card.dataset.allRequests));
                    
                    // Se syncAll for true, atualizamos todos os sub-pedidos do grupo que tenham status pendente
                    allRequests.forEach(sub => {
                        if (syncAll) {
                            if (sub.id === id || sub.status === 'pending') {
                                sub.status = reqData.status;
                                if (reqData.status === 'rejected' && reqData.rejectionReason) {
                                    sub.rejectionReason = reqData.rejectionReason;
                                }
                            }
                        } else {
                            if (sub.id === id) {
                                sub.status = reqData.status;
                                if (reqData.status === 'rejected' && reqData.rejectionReason) {
                                    sub.rejectionReason = reqData.rejectionReason;
                                }
                            }
                        }
                    });

                    // Atualizar os atributos do card
                    card.dataset.allRequests = encodeURIComponent(JSON.stringify(allRequests));
                    card.dataset.statuses = [...new Set(allRequests.map(r => r.status))].join(',');

                    // Atualizar a exibição visual do card na tela com base no filtro ativo
                    updateCardDisplayForStatus(card, activeStatus);

                    // Atualizar as linhas do modal de detalhes se estiver aberto
                    allRequests.forEach(sub => {
                        updateModalRow(sub.id, sub);
                    });
                }
            }

            await refreshStats();
            applyFilters();
        } else {
            alert('Erro ao atualizar status.');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Falha na comunicação com o servidor.');
    }
}

function updateModalRow(rowId, targetData) {
    const modalRow = document.getElementById(`modal-row-${rowId}`);
    if (modalRow) {
        const cells = modalRow.getElementsByTagName('td');
        if (cells.length > 0) {
            const actionCell = cells[cells.length - 1];
            const badgeText = targetData.status === 'approved' ? 'Aprovado' : 'Rejeitado';

            const cardId = requestIdToCardIdMap.get(rowId);
            const card = cardId ? document.getElementById(`card-${cardId}`) : null;
            let reqType = 'movie';
            let reqTitle = '';
            let reqReseller = '';
            if (card) {
                reqType = card.dataset.category || 'movie';
                reqTitle = encodeURIComponent(card.dataset.title || '');
                reqReseller = encodeURIComponent(card.dataset.reseller || '');
            }

            const hasChat = !!(targetData.rejectionReason || targetData.description);
            let chatDesc = targetData.description || '';
            if (targetData.rejectionReason && !chatDesc.includes('[Rejeitado pelo Admin')) {
                chatDesc = (chatDesc ? chatDesc + '\n' : '') + `[Rejeitado pelo Admin - Motivo: ${targetData.rejectionReason}]`;
            }

            if (targetData.status === 'pending') {
                actionCell.innerHTML = `
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;">
                        <button class="btn btn-approve" style="background: transparent; border: 1px solid var(--status-approved); color: var(--status-approved); padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s;" 
                                onmouseover="this.style.background='var(--status-approved)'; this.style.color='white';" 
                                onmouseout="this.style.background='transparent'; this.style.color='var(--status-approved)';"
                                onclick="updateStatus(${rowId}, 'approved', null, false)">
                            <i class="fas fa-check"></i> Aprovar
                        </button>
                        <button class="btn btn-reject" style="background: transparent; border: 1px solid var(--status-rejected); color: var(--status-rejected); padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s;" 
                                onmouseover="this.style.background='var(--status-rejected)'; this.style.color='white';" 
                                onmouseout="this.style.background='transparent'; this.style.color='var(--status-rejected)';"
                                onclick="openRejectModal(${rowId}, '${reqType}', false)">
                            <i class="fas fa-times"></i> Rejeitar
                        </button>
                        ${hasChat ? `
                        <button class="btn" style="background: rgba(37, 99, 235, 0.15); border: 1px solid #2563eb; color: #3b82f6; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" 
                                onmouseover="this.style.background='#2563eb'; this.style.color='white';"
                                onmouseout="this.style.background='rgba(37, 99, 235, 0.15)'; this.style.color='#3b82f6';"
                                onclick="openChatModal('${reqTitle}', '${encodeURIComponent(chatDesc).replace(/'/g, "%27")}')">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                        ` : ''}
                        <button class="btn" style="background: #222; border: 1px solid #444; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: 0.2s;" 
                                onmouseover="this.style.background='#333';"
                                onmouseout="this.style.background='#222';"
                                onclick="openOptionsModal(${rowId}, '${reqType}', '${targetData.status}', '${reqTitle}', '${reqReseller}', false)">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                `;
            } else {
                actionCell.innerHTML = `
                    <div style="display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;">
                        <span class="badge-status status-${targetData.status}" style="position: static; padding: 5px 8px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${badgeText}</span>
                        ${hasChat ? `
                        <button class="btn" style="background: rgba(37, 99, 235, 0.15); border: 1px solid #2563eb; color: #3b82f6; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" 
                                onmouseover="this.style.background='#2563eb'; this.style.color='white';"
                                onmouseout="this.style.background='rgba(37, 99, 235, 0.15)'; this.style.color='#3b82f6';"
                                onclick="openChatModal('${reqTitle}', '${encodeURIComponent(chatDesc).replace(/'/g, "%27")}')">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                        ` : ''}
                        <button class="btn" style="background: #222; border: 1px solid #444; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: 0.2s;" 
                                onmouseover="this.style.background='#333';"
                                onmouseout="this.style.background='#222';"
                                onclick="openOptionsModal(${rowId}, '${reqType}', '${targetData.status}', '${reqTitle}', '${reqReseller}', false)">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                `;
            }
        }
    }
}

async function deleteRequest(id, syncAll = true) {
    if (!confirm(syncAll ? 'Deseja realmente excluir este pedido e todos os seus agrupados permanentemente?' : 'Deseja realmente excluir este pedido individual permanentemente?')) return;

    try {
        let idsToDelete = [id];
        if (syncAll) {
            const card = document.getElementById(`card-${id}`);
            if (card && card.dataset.allRequests) {
                const data = JSON.parse(decodeURIComponent(card.dataset.allRequests));
                idsToDelete = data.map(r => r.id);
            }
        }

        let successCount = 0;
        for (const deleteId of idsToDelete) {
            const response = await fetch(`/api/requests/${deleteId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                successCount++;
            }
        }

        if (successCount > 0) {
            alert('Pedido(s) excluído(s) com sucesso!');
            location.reload();
        } else {
            alert('Erro ao excluir pedido(s).');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Falha na comunicação com o servidor.');
    }
}

let optionsRequestId = null;
let optionsRequestType = null;
let optionsRequestStatus = null;
let optionsSyncAll = true;

function openOptionsModal(id, type, status, title, reseller, syncAll = true) {
    optionsRequestId = id;
    optionsRequestType = type;
    optionsRequestStatus = status;
    optionsSyncAll = syncAll;

    // Set content details
    document.getElementById('optionsModalTitle').innerText = decodeURIComponent(title);
    document.getElementById('optionsModalReseller').innerText = decodeURIComponent(reseller);

    // Configure status badge
    const badge = document.getElementById('optionsModalStatusBadge');
    badge.className = `badge-status status-${status}`;
    badge.innerText = status === 'pending' ? 'Pendente' : (status === 'approved' ? 'Aprovado' : 'Rejeitado');

    // Configure actions visibility
    document.getElementById('optionsBtnPending').style.display = status === 'pending' ? 'none' : 'flex';
    document.getElementById('optionsBtnAddNote').style.display = status === 'pending' ? 'flex' : 'none';

    // Delete button text
    const deleteBtn = document.getElementById('optionsBtnDelete');
    deleteBtn.innerHTML = syncAll ? '<i class="fas fa-trash-alt"></i> Excluir Pedido e Agrupados' : '<i class="fas fa-trash-alt"></i> Excluir Pedido';

    document.getElementById('optionsModal').style.display = 'flex';
}

function closeOptionsModal() {
    document.getElementById('optionsModal').style.display = 'none';
}

function openChatModal(title, encodedDescription) {
    const description = decodeURIComponent(encodedDescription);
    document.getElementById('chatModalTitle').innerText = decodeURIComponent(title);

    const container = document.getElementById('chatMessagesContainer');
    container.innerHTML = '';

    // Separar as mensagens por bloco de resposta
    const blocks = description.split(/(?=\[Rejeitado pelo Admin|\[Resposta do Revendedor)/g);

    blocks.forEach(block => {
        const trimmed = block.trim();
        if (!trimmed) return;

        let isReseller = trimmed.startsWith('[Resposta do Revendedor');
        let isRejection = trimmed.startsWith('[Rejeitado pelo Admin');

        let bubbleClass = '';
        let headerText = '';
        let contentText = '';

        if (isReseller) {
            bubbleClass = 'reseller';
            const match = trimmed.match(/\[Resposta do Revendedor em ([^\]]+)\]:\s*([\s\S]*)/);
            if (match) {
                headerText = `👤 Revendedor (${match[1]})`;
                contentText = match[2];
            } else {
                headerText = `👤 Resposta do Revendedor`;
                contentText = trimmed;
            }
        } else if (isRejection) {
            bubbleClass = 'rejection';
            const match = trimmed.match(/\[Rejeitado pelo Admin - Motivo: ([^\]]+)\]\s*([\s\S]*)/);
            if (match) {
                headerText = `🚨 Rejeição - Motivo: ${match[1]}`;
                contentText = match[2] || 'Sem detalhes adicionais.';
            } else {
                headerText = `🚨 Rejeitado pelo Admin`;
                contentText = trimmed;
            }
        } else {
            bubbleClass = 'observation';
            headerText = `📝 Observações do Pedido`;
            contentText = trimmed;
        }

        container.innerHTML += `
            <div class="chat-bubble ${bubbleClass}">
                <div class="chat-bubble-header">${headerText}</div>
                <div class="chat-bubble-content">${contentText}</div>
            </div>
        `;
    });

    if (container.innerHTML === '') {
        container.innerHTML = '<div style="color: #666; text-align: center; font-size: 0.85rem; padding: 20px;">Nenhuma mensagem registrada.</div>';
    }

    document.getElementById('chatModal').style.display = 'flex';
}

function closeChatModal() {
    document.getElementById('chatModal').style.display = 'none';
}

function handleOptionsPending() {
    closeOptionsModal();
    openNoteModal('pending', (note) => {
        updateStatus(optionsRequestId, 'pending', note || null, optionsSyncAll);
    });
}

function handleOptionsAddNote() {
    closeOptionsModal();
    openNoteModal('add_note', (note) => {
        updateStatus(optionsRequestId, 'pending', note, optionsSyncAll);
    });
}

let noteModalAction = null;
function openNoteModal(actionType, confirmCallback) {
    noteModalAction = actionType;
    const cardTitle = document.getElementById('optionsModalTitle').innerText;
    document.getElementById('noteModalTitle').innerText = cardTitle;

    const header = document.getElementById('noteModalHeader');
    const textarea = document.getElementById('noteModalText');

    if (actionType === 'pending') {
        header.innerHTML = '<i class="fas fa-undo" style="color: #f59e0b;"></i> Retornar para Pendente';
        textarea.placeholder = "Deseja deixar uma pergunta ou observação? (Opcional, deixe em branco se não quiser adicionar nota)...";
        textarea.value = '';
    } else {
        header.innerHTML = '<i class="fas fa-comment-dots" style="color: #f59e0b;"></i> Pedir Explicação / Add Nota';
        textarea.placeholder = "Escreva aqui a sua pergunta ou observação detalhada para o revendedor...";
        textarea.value = '';
    }

    document.getElementById('noteModalConfirmBtn').onclick = () => {
        const note = textarea.value.trim();
        if (actionType === 'add_note' && !note) {
            alert('Por favor, digite a sua observação.');
            return;
        }
        confirmCallback(note);
        closeNoteModal();
    };

    document.getElementById('noteModal').style.display = 'flex';
}

function closeNoteModal() {
    document.getElementById('noteModal').style.display = 'none';
}

function handleOptionsDelete() {
    closeOptionsModal();
    deleteRequest(optionsRequestId, optionsSyncAll);
}

// Lógica do Botão Voltar ao Topo
const backToTopBtn = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('show');
    } else {
        backToTopBtn.classList.remove('show');
    }
});

backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

// --- PALANTIR INTEGRATION ---
let palantirSearchTitle = '';
let palantirSearchTmdbId = '';
let palantirSearchType = 'movie';

async function searchPalantir(requestId, tmdbId, titleEncoded, type) {
    const title = decodeURIComponent(titleEncoded);
    palantirSearchTitle = title;
    palantirSearchTmdbId = tmdbId;
    palantirSearchType = type || 'movie';

    // Verifica se ja ha download em andamento
    try {
        const progRes = await fetch('/api/palantir/progress');
        const progData = await progRes.json();
        if (progData.is_downloading || (progData.queue && progData.queue.length > 0)) {
            closePalantirModal();
            openPalantirProgress();
            return;
        }
    } catch {}

    document.getElementById('palantirModalTitle').innerText = `🔍 Buscar "${title}" no Palantir`;
    document.getElementById('palantirLoading').style.display = 'block';
    document.getElementById('palantirResults').style.display = 'none';
    document.getElementById('palantirError').style.display = 'none';
    document.getElementById('palantirModalFooter').style.display = 'none';
    document.getElementById('palantirModal').style.display = 'flex';

    try {
        const params = new URLSearchParams({ title, tmdb_id: tmdbId, type });
        const res = await fetch(`/api/palantir/search?${params}`);
        const data = await res.json();

        document.getElementById('palantirLoading').style.display = 'none';

        if (!res.ok) {
            document.getElementById('palantirError').style.display = 'block';
            document.getElementById('palantirError').innerText = data.error || 'Erro ao consultar Palantir';
            return;
        }

        const resultsDiv = document.getElementById('palantirResults');
        resultsDiv.style.display = 'block';

        if (data.available && data.options && data.options.length > 0) {
            const opts = data.options.map((o, i) => {
                let server = '???';
                try { const u = new URL(o.url); server = u.hostname; } catch {}
                const bannerHtml = o.banner ? `<img src="${o.banner.replace(/"/g, '&quot;')}" style="width: 28px; height: 40px; object-fit: cover; border-radius: 3px; flex-shrink: 0;" onerror="this.style.display='none'" loading="lazy">` : '';
                return { ...o, _server: server, _idx: i, _bannerHtml: bannerHtml };
            });
            // Agrupa por categoria
            const groups = {};
            opts.forEach(o => {
                const cat = o.category || 'Sem categoria';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(o);
            });
            const catKeys = Object.keys(groups);
            let html = `<div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #22c55e; font-weight: 600; font-size: 14px;"><i class="fas fa-check-circle"></i> ${opts.length} resultado(s) encontrado(s)</span>
            </div>`;
            catKeys.forEach(cat => {
                html += `<div style="margin-bottom: 10px;">
                    <div style="font-size: 12px; color: #8b5cf6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; padding: 4px 8px; background: rgba(139,92,246,0.1); border-radius: 4px;">${cat}</div>`;
                groups[cat].forEach(o => {
                    const typeBadge = o.type && o.type.toLowerCase().includes('série')
                        ? '<span style="font-size: 10px; background: rgba(59,130,246,0.2); color: #60a5fa; padding: 2px 6px; border-radius: 3px; margin-left: 6px;">Série</span>'
                        : o.type && o.type.toLowerCase().includes('filme')
                        ? '<span style="font-size: 10px; background: rgba(34,197,94,0.2); color: #22c55e; padding: 2px 6px; border-radius: 3px; margin-left: 6px;">Filme</span>'
                        : '';
                    const serverHtml = `<span style="font-size: 10px; color: var(--text-muted); margin-left: 4px;">[${o._server}]</span>`;
                    html += `<label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s; font-size: 13px;"
                        onmouseover="this.style.background='rgba(139,92,246,0.08)'" onmouseout="this.style.background='transparent'">
                        <input type="checkbox" class="palantir-option-cb" data-idx="${o._idx}" data-name="${o.name.replace(/"/g, '&quot;')}" data-url="${o.url.replace(/"/g, '&quot;')}" data-category="${(o.category || '').replace(/"/g, '&quot;')}" onclick="palantirCheckboxClick(event, ${o._idx})">
                        ${o._bannerHtml}
                        <span style="flex: 1; display: flex; align-items: center; gap: 6px;"><span>${o.name}${typeBadge}</span><span style="font-size: 10px; color: var(--text-muted);">[${o._server}]</span></span>
                    </label>`;
                });
                html += `</div>`;
            });
            html += opts.length > 10 ? `<div style="text-align: center; margin-top: 6px;"><label style="font-size: 12px; color: var(--text-muted); cursor: pointer;"><input type="checkbox" id="palantirSelectAllInline" onchange="togglePalantirSelectAll()"> Selecionar Todos (${opts.length})</label></div>` : '';
            resultsDiv.innerHTML = html;
            document.getElementById('palantirModalFooter').style.display = 'flex';
            updatePalantirCount();
        } else {
            let html = `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 10px; padding: 20px; text-align: center;">
                <i class="fas fa-times-circle" style="font-size: 2.5rem; color: #ef4444;"></i>
                <h4 style="color: #ef4444; margin: 10px 0 5px;">Não Encontrado</h4>
                <p style="color: var(--text-muted); font-size: 13px;">O conteúdo "${title}" não foi encontrado no banco do Palantir.</p>`;
            if (data.message) {
                html += `<p style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">${data.message}</p>`;
            }
            html += `</div>`;
            resultsDiv.innerHTML = html;
        }
    } catch (e) {
        document.getElementById('palantirLoading').style.display = 'none';
        document.getElementById('palantirError').style.display = 'block';
        document.getElementById('palantirError').innerText = 'Erro de conexão: ' + e.message;
    }
}

let lastPalantirCheckedIdx = -1;

function palantirCheckboxClick(event, idx) {
    if (event.shiftKey && lastPalantirCheckedIdx >= 0) {
        const start = Math.min(lastPalantirCheckedIdx, idx);
        const end = Math.max(lastPalantirCheckedIdx, idx);
        const cbs = document.querySelectorAll('.palantir-option-cb');
        const checked = event.target.checked;
        cbs.forEach(cb => {
            const ci = parseInt(cb.dataset.idx);
            if (ci >= start && ci <= end) cb.checked = checked;
        });
    }
    lastPalantirCheckedIdx = idx;
    updatePalantirCount();
}

function updatePalantirCount() {
    const cbs = document.querySelectorAll('.palantir-option-cb:checked');
    const countEl = document.getElementById('palantirSelectedCount');
    if (countEl) countEl.textContent = cbs.length;
    const btn = document.getElementById('btnPalantirDownload');
    if (cbs.length === 0) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
    // Sincroniza "Selecionar Todos" do footer com os checkboxes
    const selectAll = document.getElementById('palantirSelectAll');
    const allCbs = document.querySelectorAll('.palantir-option-cb');
    if (selectAll) selectAll.checked = allCbs.length > 0 && cbs.length === allCbs.length;
}

function togglePalantirSelectAll() {
    const selectAll = document.getElementById('palantirSelectAll');
    if (!selectAll) return;
    const checked = selectAll.checked;
    document.querySelectorAll('.palantir-option-cb').forEach(cb => cb.checked = checked);
    lastPalantirCheckedIdx = -1;
    updatePalantirCount();
}

async function startPalantirDownload() {
    const cbs = document.querySelectorAll('.palantir-option-cb:checked');
    if (cbs.length === 0) return;

    const btn = document.getElementById('btnPalantirDownload');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enfileirando...';

    const items = [];
    cbs.forEach(cb => {
        items.push({
            name: cb.dataset.name,
            url: cb.dataset.url,
            category: cb.dataset.category
        });
    });

    const total = items.length;
    let success = 0;
    let failed = 0;

    document.getElementById('palantirModalFooter').style.display = 'none';
    document.getElementById('palantirResults').innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: #8b5cf6;"></i>
        <p style="margin-top: 10px;">Enfileirando ${total} item(ns) no Palantir...</p>
        <p style="font-size: 12px; margin-top: 6px;" id="palantirDownloadProgress">0 / ${total}</p>
    </div>`;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
            const res = await fetch('/api/palantir/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: item.name,
                    url: item.url,
                    category: item.category,
                    title: palantirSearchTitle,
                    tmdb_id: palantirSearchTmdbId,
                    type: palantirSearchType
                })
            });
            const data = await res.json();
            if (res.ok) {
                success++;
            } else {
                failed++;
                console.error('Falha ao adicionar:', item.name, data);
            }
        } catch (e) {
            failed++;
            console.error('Erro ao adicionar:', item.name, e);
        }
        document.getElementById('palantirDownloadProgress').textContent = `${i + 1} / ${total}`;
    }

    const progressEl = document.getElementById('palantirResults');
    if (failed === 0) {
        progressEl.innerHTML = `<div style="text-align: center; padding: 20px; color: #22c55e;">
            <i class="fas fa-check-circle" style="font-size: 2rem;"></i>
            <p style="margin-top: 8px;">${success} item(ns) enfileirado(s) com sucesso!</p>
        </div>`;
    } else {
        progressEl.innerHTML = `<div style="text-align: center; padding: 20px;">
            <p style="color: #22c55e;">${success} enfileirado(s)</p>
            <p style="color: #ef4444;">${failed} falha(s)</p>
        </div>`;
    }

    setTimeout(() => {
        closePalantirModal();
        openPalantirProgress();
    }, 1200);
}

let palantirProgressInterval = null;

function openPalantirProgress() {
    document.getElementById('palantirProgressBar').style.width = '0%';
    document.getElementById('palantirProgressBar').style.background = 'linear-gradient(90deg, #8b5cf6, #6d28d9)';
    document.getElementById('palantirProgressText').innerText = 'Iniciando...';
    document.getElementById('palantirProgressSpeed').textContent = '0 MB/s';
    document.getElementById('palantirProgressEta').textContent = '--';
    document.getElementById('palantirProgressQueueList').innerHTML = '';
    document.getElementById('palantirProgressModal').style.display = 'flex';

    palantirProgressInterval = setInterval(pollPalantirProgress, 2000);
    pollPalantirProgress();
}

function closePalantirProgressModal() {
    document.getElementById('palantirProgressModal').style.display = 'none';
    if (palantirProgressInterval) {
        clearInterval(palantirProgressInterval);
        palantirProgressInterval = null;
    }
}

function renderQueueList(queue, current) {
    const list = document.getElementById('palantirProgressQueueList');
    let html = '';
    if (current) {
        html += `<div style="display: flex; align-items: center; gap: 6px; padding: 3px 0;">
            <i class="fas fa-download" style="color: #8b5cf6; font-size: 10px;"></i>
            <span style="color: #c4b5fd; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${current}</span>
            <span style="font-size: 10px; color: #8b5cf6; font-weight: 600;">AGORA</span>
        </div>`;
    }
    (queue || []).forEach(item => {
        html += `<div style="display: flex; align-items: center; gap: 6px; padding: 3px 0;">
            <i class="fas fa-clock" style="color: var(--text-muted); font-size: 10px;"></i>
            <span style="color: var(--text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item}</span>
        </div>`;
    });
    if (!html) {
        html = '<div style="color: var(--text-muted); text-align: center; padding: 6px;">Nenhum item na fila</div>';
    }
    list.innerHTML = html;
}

async function pollPalantirProgress() {
    try {
        const res = await fetch('/api/palantir/progress');
        const data = await res.json();

        document.getElementById('palantirProgressSpeed').textContent = data.speed || '0 MB/s';
        document.getElementById('palantirProgressEta').textContent = data.eta ? `ETA: ${data.eta}` : '--';

        if (data.is_downloading) {
            document.getElementById('palantirProgressText').innerText = data.current || 'Baixando...';
            if (data.progress !== undefined) {
                document.getElementById('palantirProgressBar').style.width = Math.min(data.progress, 100) + '%';
            } else {
                document.getElementById('palantirProgressBar').style.width = '50%';
            }
            renderQueueList(data.queue, data.current);
        } else {
            const hasQueue = data.queue && data.queue.length > 0;
            if (hasQueue) {
                document.getElementById('palantirProgressText').innerText = 'Aguardando na fila...';
                document.getElementById('palantirProgressBar').style.width = '10%';
                renderQueueList(data.queue, null);
            } else {
                document.getElementById('palantirProgressText').innerText = '✅ Download concluído!';
                document.getElementById('palantirProgressBar').style.width = '100%';
                document.getElementById('palantirProgressBar').style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
                document.getElementById('palantirProgressSpeed').textContent = '';
                document.getElementById('palantirProgressEta').textContent = '';
                renderQueueList([], null);
                if (palantirProgressInterval) {
                    clearInterval(palantirProgressInterval);
                    palantirProgressInterval = null;
                }
                setTimeout(closePalantirProgressModal, 3000);
            }
        }
    } catch (e) {
        document.getElementById('palantirProgressSpeed').textContent = 'Erro';
        document.getElementById('palantirProgressEta').textContent = '';
    }
}

function closePalantirModal() {
    document.getElementById('palantirModal').style.display = 'none';
}


// --- CONFIGURAÇÃO GERAL MODAL (POPUP) ---
function openSettingsModal() {
    // Fechar todas as seções por padrão
    const sections = ['palantirConfigSection', 'whatsappConfigSection', 'botbotConfigSection', 'm3uConfigSection', 'rejectionsConfigSection', 'tmdbConfigSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('open');
    });
    
    fetch('/api/config/palantir')
        .then(res => res.json())
        .then(data => {
            document.getElementById('palantirUrlInput').value = data.url || '';
            document.getElementById('palantirTokenInput').value = data.token || '';
            document.getElementById('palantirEnabledToggle').checked = data.enabled !== false;
            
            const modal = document.getElementById('settingsModal');
            modal.style.display = 'flex';
        })
        .catch(err => {
            alert('Falha ao carregar configurações do Palantir: ' + err.message);
        });

    fetch('/api/config/tmdb')
        .then(res => res.json())
        .then(data => {
            document.getElementById('tmdbApiKeyInput').value = data.apiKey || '';
        })
        .catch(() => {});
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
    // Garantir que a rotina do navegador/start de sessão para WhatsApp do painel pare se o modal fechar
    const waConfigSection = document.getElementById('whatsappConfigSection');
    if (waConfigSection) waConfigSection.classList.remove('open');
}

function toggleSettingsSection(sectionId) {
    const sections = ['palantirConfigSection', 'whatsappConfigSection', 'botbotConfigSection', 'm3uConfigSection', 'rejectionsConfigSection', 'tmdbConfigSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === sectionId) {
            el.classList.toggle('open');
            
            // Ações específicas ao abrir seção
            if (id === 'whatsappConfigSection' && el.classList.contains('open')) {
                // Força inicialização/conexão se o whatsapp não estiver iniciado
                fetch('/api/whatsapp/start', { method: 'POST' }).catch(err => console.error(err));
            }
            if (id === 'botbotConfigSection' && el.classList.contains('open')) {
                loadBotBotConfig();
            }
            if (id === 'm3uConfigSection' && el.classList.contains('open')) {
                loadM3uConfig();
            }
            if (id === 'rejectionsConfigSection' && el.classList.contains('open')) {
                loadRejectionReasonsConfig();
            }
        } else {
            el.classList.remove('open');
        }
    });
}

// --- FUNÇÕES M3U PLAYLIST ---
async function loadM3uConfig() {
    try {
        const res = await fetch('/api/m3u/status');
        const data = await res.json();
        if (data.success) {
            document.getElementById('m3uSourceInputConfig').value = data.source || 'exemplo.m3u';
            document.getElementById('m3uLastSyncConfig').innerText = data.lastSync || 'Nunca sincronizado';
            if (data.stats && typeof data.stats.movies !== 'undefined') {
                document.getElementById('m3uStatsConfig').innerText = `${data.stats.movies} filmes, ${data.stats.series} séries`;
            } else {
                document.getElementById('m3uStatsConfig').innerText = 'Sem dados de estatísticas';
            }
        }
    } catch (e) {
        console.error("Erro ao obter status M3U:", e);
    }
}

async function runM3uSyncConfig() {
    const source = document.getElementById('m3uSourceInputConfig').value.trim();
    if (!source) {
        alert('Por favor, informe a URL ou caminho da playlist.');
        return;
    }

    const confirmBtn = document.getElementById('m3uSyncConfirmBtnConfig');
    const loadingMsg = document.getElementById('m3uLoadingMsgConfig');

    confirmBtn.disabled = true;
    loadingMsg.style.display = 'flex';

    try {
        const res = await fetch('/api/m3u/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source })
        });
        const data = await res.json();
        if (data.success) {
            alert('Sincronização M3U concluída com sucesso! A página será recarregada.');
            window.location.reload();
        } else {
            alert('Erro na sincronização: ' + (data.error || 'Erro desconhecido'));
            confirmBtn.disabled = false;
            loadingMsg.style.display = 'none';
        }
    } catch (e) {
        alert('Falha crítica na sincronização: ' + e.message);
        confirmBtn.disabled = false;
        loadingMsg.style.display = 'none';
    }
}

async function runM3uClearConfig() {
    if (!confirm('Deseja realmente limpar todos os dados importados da M3U? Isso removerá o indicador de presença dos pedidos.')) return;
    const clearBtn = document.getElementById('m3uClearBtnConfig');
    clearBtn.disabled = true;
    try {
        const res = await fetch('/api/m3u/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            alert('Dados da M3U limpos com sucesso! A página será recarregada.');
            window.location.reload();
        } else {
            alert('Erro ao limpar dados: ' + (data.error || 'Erro desconhecido'));
            clearBtn.disabled = false;
        }
    } catch (e) {
        alert('Falha crítica ao limpar dados: ' + e.message);
        clearBtn.disabled = false;
    }
}

function savePalantirConfig() {
    const url = document.getElementById('palantirUrlInput').value.trim();
    const token = document.getElementById('palantirTokenInput').value.trim();
    const enabled = document.getElementById('palantirEnabledToggle').checked;
    
    if (!url || !token) {
        alert('Por favor, preencha todos os campos.');
        return;
    }
    
    const msgDiv = document.getElementById('palantirSaveMsg');
    msgDiv.style.color = '#f59e0b';
    msgDiv.style.display = 'flex';
    msgDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Salvando configurações...</span>';
    
    fetch('/api/config/palantir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, enabled })
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
        return data;
    })
    .then(data => {
        msgDiv.style.color = '#10b981';
        msgDiv.innerHTML = '<i class="fas fa-check-circle"></i> <span>Configuração salva com sucesso!</span>';
        setTimeout(() => {
            msgDiv.style.display = 'none';
            location.reload();
        }, 1500);
    })
    .catch(err => {
        msgDiv.style.color = '#ef4444';
        msgDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>Erro: ${err.message}</span>`;
    });
}

function testPalantirConfig() {
    const url = document.getElementById('palantirUrlInput').value.trim();
    const token = document.getElementById('palantirTokenInput').value.trim();
    
    if (!url || !token) {
        alert('Por favor, preencha a URL e o Token antes de testar a conexão.');
        return;
    }
    
    const msgDiv = document.getElementById('palantirSaveMsg');
    msgDiv.style.color = '#3b82f6';
    msgDiv.style.display = 'flex';
    msgDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Testando conexão com a instância do Palantir...</span>';
    
    fetch('/api/palantir/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token })
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao conectar.');
        return data;
    })
    .then(data => {
        msgDiv.style.color = '#10b981';
        msgDiv.innerHTML = `<i class="fas fa-check-circle"></i> <span>${data.message || 'Conexão estabelecida com sucesso!'}</span>`;
    })
    .catch(err => {
        msgDiv.style.color = '#ef4444';
        msgDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${err.message}</span>`;
    });
}

// --- FUNÇÕES TMDB API ---
function saveTmdbConfig() {
    const apiKey = document.getElementById('tmdbApiKeyInput').value.trim();
    if (!apiKey) {
        alert('Por favor, insira a chave de API.');
        return;
    }

    const msgDiv = document.getElementById('tmdbSaveMsg');
    msgDiv.style.color = '#01b4e4';
    msgDiv.style.display = 'flex';
    msgDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Salvando...</span>';

    fetch('/api/config/tmdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
        return data;
    })
    .then(data => {
        msgDiv.style.color = '#10b981';
        msgDiv.innerHTML = '<i class="fas fa-check-circle"></i> <span>Chave TMDB salva com sucesso!</span>';
        setTimeout(() => {
            msgDiv.style.display = 'none';
            location.reload();
        }, 1500);
    })
    .catch(err => {
        msgDiv.style.color = '#ef4444';
        msgDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>Erro: ${err.message}</span>`;
    });
}

function toggleTmdbKeyVisibility() {
    const input = document.getElementById('tmdbApiKeyInput');
    const icon = document.getElementById('tmdbEyeIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// --- FUNÇÕES WHATSAPP LOCAL ---
async function resetWaConnection() {
    if (!confirm("Deseja forçar o encerramento da sessão atual?")) return;
    document.getElementById('waConfigQrContainer').innerHTML = '<div style="color: #000; font-weight: 600;"><i class="fas fa-spinner fa-spin"></i> Reiniciando...</div>';
    await fetch('/api/whatsapp/reset', { method: 'POST' });
}

async function logoutWaConnection() {
    if (!confirm("Deseja encerrar a sua sessão atual do WhatsApp?\n\nIsso removerá a conexão e você precisará ler o QR Code novamente.")) return;
    document.getElementById('waConfigQrContainer').innerHTML = '<div style="color: #000; font-weight: 600;"><i class="fas fa-spinner fa-spin"></i> Desconectando...</div>';
    await fetch('/api/whatsapp/reset', { method: 'POST' });
}

async function resendAllWaNotifications() {
    if (!confirm("Deseja reenviar a notificação dos ÚLTIMOS 50 pedidos processados? \n\nIsso rodará em segundo plano.")) return;
    try {
        const res = await fetch('/api/notifications/resend-all', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Processo iniciado com sucesso!');
    } catch (e) {
        alert('Erro ao iniciar reenvio.');
    }
}

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
// --- FIM CONFIGURAÇÕES WHATSAPP / BOTBOT ---

// --- LOCK DE MANUTENÇÃO ---
function openLockModal() {
    fetch('/api/lock')
        .then(res => res.json())
        .then(data => {
            document.getElementById('lockEnabled').checked = data.enabled;
            document.getElementById('lockMessage').value = data.message || '';
            document.getElementById('lockModal').style.display = 'flex';
        })
        .catch(err => alert('Falha ao carregar lock: ' + err.message));
}

function closeLockModal() {
    document.getElementById('lockModal').style.display = 'none';
}

function saveLock() {
    const enabled = document.getElementById('lockEnabled').checked;
    const message = document.getElementById('lockMessage').value.trim();
    const btn = document.querySelector('#lockModal button:last-child');
    btn.disabled = true;
    btn.textContent = 'SALVANDO...';
    fetch('/api/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, message })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('lockBtnLabel').textContent = enabled ? 'LOCK 🔒' : 'LOCK';
            closeLockModal();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao salvar'));
        }
    })
    .catch(err => alert('Erro: ' + err.message))
    .finally(() => {
        btn.disabled = false;
        btn.textContent = 'SALVAR';
    });
}
// --- FIM LOCK ---

// --- REJEIÇÕES DINÂMICAS ---
function loadRejectionReasonsConfig() {
    renderRejectionsList();
    cancelRejectReasonForm();
}

function renderRejectionsList() {
    const listEl = document.getElementById('rejectReasonsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    localRejectionReasons.forEach(reason => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px';
        item.style.background = 'rgba(255, 255, 255, 0.03)';
        item.style.borderRadius = '6px';
        item.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        item.style.fontSize = '0.8rem';
        
        item.innerHTML = `
            <div style="text-align: left; flex: 1; min-width: 0; padding-right: 10px;">
                <strong style="color: #fff; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${reason.title}</strong>
                <span style="color: #666; font-size: 0.7rem;">Ordem: ${reason.sort_order}</span>
            </div>
            <div style="display: flex; gap: 6px;">
                <button class="btn" style="background: #2563eb; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; cursor: pointer;" onclick="editRejectReason(${reason.id})">EDITAR</button>
                <button class="btn" style="background: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; cursor: pointer;" onclick="deleteRejectReason(${reason.id})">EXCLUIR</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function renderModalQuickRejectButtons() {
    const container = document.getElementById('modalQuickRejectButtons');
    if (!container) return;
    container.innerHTML = '';
    localRejectionReasons.forEach(reason => {
        const btn = document.createElement('button');
        btn.className = 'btn-quick';
        btn.textContent = reason.title;
        btn.onclick = () => setReason(reason.id);
        container.appendChild(btn);
    });
}

function prepareNewRejectReason() {
    document.getElementById('rejectFormTitle').textContent = 'Novo Botão de Rejeição';
    document.getElementById('rejectReasonId').value = '';
    document.getElementById('rejectReasonTitleInput').value = '';
    document.getElementById('rejectReasonTemplateInput').value = '';
    document.getElementById('rejectReasonOrderInput').value = localRejectionReasons.length + 1;
    document.getElementById('rejectReasonForm').style.display = 'block';
}

function editRejectReason(id) {
    const reason = localRejectionReasons.find(r => r.id === id);
    if (!reason) return;
    document.getElementById('rejectFormTitle').textContent = 'Editar Botão';
    document.getElementById('rejectReasonId').value = reason.id;
    document.getElementById('rejectReasonTitleInput').value = reason.title;
    document.getElementById('rejectReasonTemplateInput').value = reason.template;
    document.getElementById('rejectReasonOrderInput').value = reason.sort_order || 0;
    document.getElementById('rejectReasonForm').style.display = 'block';
}

function cancelRejectReasonForm() {
    document.getElementById('rejectReasonForm').style.display = 'none';
    document.getElementById('rejectReasonId').value = '';
    document.getElementById('rejectReasonTitleInput').value = '';
    document.getElementById('rejectReasonTemplateInput').value = '';
}

async function saveRejectReason() {
    const id = document.getElementById('rejectReasonId').value;
    const title = document.getElementById('rejectReasonTitleInput').value.trim();
    const template = document.getElementById('rejectReasonTemplateInput').value.trim();
    const sort_order = parseInt(document.getElementById('rejectReasonOrderInput').value) || 0;

    if (!title || !template) {
        alert('Título e Mensagem do modelo são obrigatórios.');
        return;
    }

    try {
        const res = await fetch('/api/config/rejection-reasons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id ? parseInt(id) : null, title, template, sort_order })
        });

        if (res.ok) {
            alert('Botão de rejeição salvo com sucesso!');
            
            if (id) {
                const index = localRejectionReasons.findIndex(r => r.id === parseInt(id));
                if (index !== -1) {
                    localRejectionReasons[index] = { id: parseInt(id), title, template, sort_order };
                }
            } else {
                // Recarregar a página para obter o ID gerado pelo banco para o novo botão
                window.location.reload();
                return;
            }
            
            localRejectionReasons.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
            renderRejectionsList();
            renderModalQuickRejectButtons();
            cancelRejectReasonForm();
        } else {
            const data = await res.json();
            alert('Erro ao salvar: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (err) {
        alert('Erro na requisição: ' + err.message);
    }
}

async function deleteRejectReason(id) {
    if (!confirm('Deseja realmente excluir este botão de rejeição?')) return;

    try {
        const res = await fetch(`/api/config/rejection-reasons/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert('Botão excluído com sucesso!');
            localRejectionReasons = localRejectionReasons.filter(r => r.id !== id);
            renderRejectionsList();
            renderModalQuickRejectButtons();
            cancelRejectReasonForm();
        } else {
            const data = await res.json();
            alert('Erro ao excluir: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (err) {
        alert('Erro na requisição: ' + err.message);
    }
}

// Aplica o filtro de status inicial (Pendentes) ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    initRequestIdMap();
    applyFilters();
    sortCards();
    // Atualiza label do lock
    fetch('/api/lock').then(r => r.json()).then(d => {
        document.getElementById('lockBtnLabel').textContent = d.enabled ? 'LOCK 🔒' : 'LOCK';
    }).catch(() => {});

    const testPalantirBtn = document.getElementById('btnTestPalantirConfig');
    if (testPalantirBtn) {
        testPalantirBtn.addEventListener('click', testPalantirConfig);
    }
});


// Expose functions globally for EJS onclick handlers
window.initRequestIdMap = initRequestIdMap;
window.startM3uSyncHeader = startM3uSyncHeader;
window.closeM3uDetailsModal = closeM3uDetailsModal;
window.showM3uDetails = showM3uDetails;
window.checkWaStatus = checkWaStatus;
window.debouncedApplyFilters = debouncedApplyFilters;
window.updateCardDisplayForStatus = updateCardDisplayForStatus;
window.applyFilters = applyFilters;
window.sortCards = sortCards;
window.filterCategory = filterCategory;
window.filterStatus = filterStatus;
window.refreshStats = refreshStats;
window.openRejectModal = openRejectModal;
window.closeRejectModal = closeRejectModal;
window.openDetailsModal = openDetailsModal;
window.closeDetailsModal = closeDetailsModal;
window.setReason = setReason;
window.updateStatus = updateStatus;
window.updateModalRow = updateModalRow;
window.deleteRequest = deleteRequest;
window.openOptionsModal = openOptionsModal;
window.closeOptionsModal = closeOptionsModal;
window.openChatModal = openChatModal;
window.closeChatModal = closeChatModal;
window.handleOptionsPending = handleOptionsPending;
window.handleOptionsAddNote = handleOptionsAddNote;
window.openNoteModal = openNoteModal;
window.closeNoteModal = closeNoteModal;
window.handleOptionsDelete = handleOptionsDelete;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;
window.searchPalantir = searchPalantir;
window.palantirCheckboxClick = palantirCheckboxClick;
window.updatePalantirCount = updatePalantirCount;
window.togglePalantirSelectAll = togglePalantirSelectAll;
window.startPalantirDownload = startPalantirDownload;
window.openPalantirProgress = openPalantirProgress;
window.closePalantirProgressModal = closePalantirProgressModal;
window.renderQueueList = renderQueueList;
window.pollPalantirProgress = pollPalantirProgress;
window.closePalantirModal = closePalantirModal;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.toggleSettingsSection = toggleSettingsSection;
window.loadM3uConfig = loadM3uConfig;
window.runM3uSyncConfig = runM3uSyncConfig;
window.runM3uClearConfig = runM3uClearConfig;
window.savePalantirConfig = savePalantirConfig;
window.testPalantirConfig = testPalantirConfig;
window.saveTmdbConfig = saveTmdbConfig;
window.toggleTmdbKeyVisibility = toggleTmdbKeyVisibility;
window.resetWaConnection = resetWaConnection;
window.logoutWaConnection = logoutWaConnection;
window.resendAllWaNotifications = resendAllWaNotifications;
window.loadBotBotConfig = loadBotBotConfig;
window.saveBbConfig = saveBbConfig;
window.resendAllBbNotifications = resendAllBbNotifications;
window.testBbConnection = testBbConnection;
window.openLockModal = openLockModal;
window.closeLockModal = closeLockModal;
window.saveLock = saveLock;
window.loadRejectionReasonsConfig = loadRejectionReasonsConfig;
window.renderRejectionsList = renderRejectionsList;
window.renderModalQuickRejectButtons = renderModalQuickRejectButtons;
window.prepareNewRejectReason = prepareNewRejectReason;
window.editRejectReason = editRejectReason;
window.cancelRejectReasonForm = cancelRejectReasonForm;
window.saveRejectReason = saveRejectReason;
window.deleteRejectReason = deleteRejectReason;
