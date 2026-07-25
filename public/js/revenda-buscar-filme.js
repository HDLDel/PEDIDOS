const API_KEY = '<TMDB_API_KEY>';
    
    async function buscarFilme(e) {
      e.preventDefault();
      const query = document.getElementById('searchInput').value.trim();
      const container = document.getElementById('resultsContainer');
      
      if (!query) return;
      
      container.innerHTML = '<div class="loading">🔍 Buscando no TMDB...</div>';
      
      try {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR&page=1`);
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
          container.innerHTML = '<div class="empty">😕 Nenhum filme encontrado. Tente outro título.</div>';
          return;
        }
        
        const html = data.results.slice(0, 8).map(movie => {
          const poster = movie.poster_path 
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : 'https://via.placeholder.com/500x750/1a1a1a/666?text=Sem+Poster';
          const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
          
          return `
            <div class="result-card" onclick="selecionarFilme(${movie.id}, '${escapeHtml(movie.title)}', '${year}', '${poster}')">
              <img src="${poster}" alt="${escapeHtml(movie.title)}" class="poster">
              <div class="info">
                <div class="title">${escapeHtml(movie.title)}</div>
                <div class="year">📅 ${year} | ⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</div>
              </div>
            </div>
          `;
        }).join('');
        
        container.innerHTML = `<div class="results-grid">${html}</div>`;
        
      } catch (err) {
        container.innerHTML = '<div class="empty">❌ Erro ao buscar. Tente novamente.</div>';
        console.error(err);
      }
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
    }
    
    async function selecionarFilme(tmdbId, title, year, poster) {
      if (!confirm(`Deseja solicitar o filme "${title}" (${year})?`)) return;
      
      try {
        const response = await fetch('/revenda/api/solicitar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'movie',
            title: title,
            year: year,
            poster: poster,
            tmdbId: tmdbId,
            action: 'Adicionar ao catálogo',
            requestType: 'content'
          })
        });
        
        if (response.ok) {
          alert('✅ Solicitação enviada com sucesso! Você pode acompanhar o status no seu painel.');
          window.location.href = '/revenda/dashboard';
        } else {
          alert('❌ Erro ao enviar solicitação.');
        }
      } catch (err) {
        alert('❌ Erro de conexão.');
        console.error(err);
      }
    }

// Expose functions globally for EJS onclick handlers
window.buscarFilme = buscarFilme;
window.escapeHtml = escapeHtml;
window.selecionarFilme = selecionarFilme;
