let explainRequestId = null;

    function openExplanationModal(id, title, reason) {
      explainRequestId = id;
      document.getElementById('explainModalTitle').innerText = decodeURIComponent(title);
      
      const decodedReason = decodeURIComponent(reason);
      const reasonContainer = document.getElementById('explainModalReasonContainer');
      if (decodedReason && decodedReason.trim() !== '' && decodedReason !== 'null' && decodedReason !== 'undefined') {
        document.getElementById('explainModalReason').innerText = decodedReason;
        reasonContainer.style.display = 'block';
      } else {
        reasonContainer.style.display = 'none';
      }
      
      document.getElementById('explanationText').value = '';
      document.getElementById('explanationModal').style.display = 'flex';
    }

    function closeExplanationModal() {
      document.getElementById('explanationModal').style.display = 'none';
    }

    async function submitExplanation() {
      const explanation = document.getElementById('explanationText').value.trim();
      if (!explanation) {
        alert('Por favor, digite sua explicação antes de enviar.');
        return;
      }

      try {
        const response = await fetch(`/api/requests/${explainRequestId}/respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ explanation })
        });

        if (response.ok) {
          alert('Resposta enviada com sucesso! O pedido voltou para a fila de pendentes.');
          location.reload();
        } else {
          alert('Erro ao enviar resposta.');
        }
      } catch (error) {
        console.error('Erro:', error);
        alert('Falha na comunicação com o servidor.');
      }
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
            headerText = `👤 Minha Resposta`;
            contentText = trimmed;
          }
        } else if (isRejection) {
          bubbleClass = 'rejection';
          const match = trimmed.match(/\[Rejeitado pelo Admin - Motivo: ([^\]]+)\]\s*([\s\S]*)/);
          if (match) {
            headerText = `🚨 Rejeitado pelo Admin - Motivo: ${match[1]}`;
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
        container.innerHTML = '<div style="color: #666; text-align: center; font-size: 0.85rem; padding: 20px;">Nenhuma observação registrada.</div>';
      }
      
      document.getElementById('chatModal').style.display = 'flex';
    }

    function closeChatModal() {
      document.getElementById('chatModal').style.display = 'none';
    }

    function openDemoraModal() {
      document.getElementById('demoraModal').style.display = 'flex';
    }

    function closeDemoraModal() {
      document.getElementById('demoraModal').style.display = 'none';
    }

    async function deleteRequest(id, title) {
      const decodedTitle = decodeURIComponent(title);
      if (!confirm(`Tem certeza de que deseja excluir o pedido de "${decodedTitle}"? Esta ação liberará espaço na sua fila de pendentes.`)) {
        return;
      }

      try {
        const response = await fetch(`/api/requests/revenda/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          alert('Pedido excluído com sucesso!');
          location.reload();
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao excluir pedido.');
        }
      } catch (error) {
        console.error('Erro:', error);
        alert('Falha na comunicação com o servidor.');
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

      // Episódios
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
window.openExplanationModal = openExplanationModal;
window.closeExplanationModal = closeExplanationModal;
window.submitExplanation = submitExplanation;
window.openChatModal = openChatModal;
window.closeChatModal = closeChatModal;
window.openDemoraModal = openDemoraModal;
window.closeDemoraModal = closeDemoraModal;
window.deleteRequest = deleteRequest;
window.closeM3uDetailsModal = closeM3uDetailsModal;
window.showM3uDetails = showM3uDetails;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;
