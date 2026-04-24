// ==UserScript==
// @name         TMDB+JUSTWATCH com link
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  Busca informações de filmes e séries no TMDB com suporte para múltiplos resultados + link JustWatch
// @author       Seu Nome
// @match        https://pedidos.imperioapps.top/*
// @match        https://*.pedidos.imperioapps.top/*/*
// @grant        GM_xmlhttpRequest
// @connect      api.themoviedb.org
// @connect      image.tmdb.org
// ==/UserScript==

(function() {
    'use strict';

    // Configuração da API do TMDB
    const TMDB_API_KEY = '<TMDB_API_KEY>';
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
    const JUSTWATCH_BASE_URL = 'https://www.justwatch.com/br/busca?q=';

    // Função para buscar informações no TMDB com múltiplos resultados
    function buscarInformacoesTMDB(nome, tipo, limite = 5) {
        return new Promise((resolve, reject) => {
            const endpoint = tipo === 'Série' ? 'tv' : 'movie';
            const url = `${TMDB_BASE_URL}/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(nome)}&language=pt-BR&page=1`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: { 'Accept': 'application/json' },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.results && data.results.length > 0) {
                            // Limitar número de resultados
                            const resultados = data.results.slice(0, limite);
                            resolve(resultados);
                        } else {
                            resolve([]);
                        }
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: reject
            });
        });
    }

    // Função para buscar provedores de streaming
    function buscarProvedoresTMDB(id, tipo) {
        return new Promise((resolve, reject) => {
            const endpoint = `${tipo}/${id}/watch/providers`;
            const url = `${TMDB_BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: { 'Accept': 'application/json' },
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: reject
            });
        });
    }

    // Função para criar link do JustWatch
    function criarLinkJustWatch(titulo) {
        return `${JUSTWATCH_BASE_URL}${encodeURIComponent(titulo)}`;
    }

    // Função para criar o HTML da seleção de múltiplos resultados
    function criarHTMLSelecao(resultados, tipo) {
        if (!resultados || resultados.length === 0) {
            return '<p>Nenhum resultado encontrado no TMDB</p>';
        }

        const isSerie = tipo === 'Série';

        return `
            <div class="tmdb-selecao" style="font-family: Arial, sans-serif;">
                <h3 style="color: #007bff; margin: 0 0 20px 0; text-align: center;">
                    🔍 Selecione a ${isSerie ? 'série' : 'obra'} correta
                </h3>
                <p style="color: #666; margin-bottom: 20px; text-align: center;">
                    Encontramos ${resultados.length} resultados. Selecione o correto:
                </p>

                <div class="tmdb-resultados-lista" style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
                    ${resultados.map((item, index) => {
                        const posterUrl = item.poster_path
                            ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
                            : 'https://via.placeholder.com/200x300/333/666?text=Sem+Poster';

                        const titulo = isSerie ? item.name : item.title;
                        const dataLancamento = item.release_date || item.first_air_date
                            ? new Date(item.release_date || item.first_air_date).toLocaleDateString('pt-BR')
                            : 'Data não disponível';

                        const nota = item.vote_average
                            ? Number(item.vote_average).toFixed(1)
                            : 'N/A';

                        const sinopse = item.overview
                            ? (item.overview.length > 150 ? item.overview.substring(0, 150) + '...' : item.overview)
                            : 'Sinopse não disponível';

                        // CORREÇÃO AQUI: usar item.release_date/item.first_air_date em vez de 'item'
                        const ano = item.release_date || item.first_air_date
                            ? new Date(item.release_date || item.first_air_date).getFullYear()
                            : 'N/A';

                        const justwatchLink = criarLinkJustWatch(titulo);

                        return `
                            <div class="tmdb-resultado-item"
                                 data-id="${item.id}"
                                 data-index="${index}"
                                 style="display: flex; margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; cursor: pointer; transition: all 0.3s; border: 2px solid #e9ecef;"
                                 onmouseover="this.style.borderColor='#007bff'; this.style.backgroundColor='#e9ecef'"
                                 onmouseout="this.style.borderColor='#e9ecef'; this.style.backgroundColor='#f8f9fa'">

                                <div style="flex-shrink: 0; margin-right: 15px;">
                                    <img src="${posterUrl}"
                                         alt="${titulo}"
                                         style="width: 80px; height: 120px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                </div>

                                <div style="flex-grow: 1;">
                                    <h4 style="margin: 0 0 8px 0; color: #212529; font-size: 16px;">
                                        ${titulo} <span style="color: #6c757d; font-weight: normal;">(${ano})</span>
                                    </h4>

                                    <div style="display: flex; gap: 15px; margin-bottom: 10px;">
                                        <span style="color: #ff6b00; font-weight: bold;">
                                            ⭐ ${nota}/10
                                        </span>
                                        <span style="color: #007bff; font-weight: bold;">
                                            📅 ${dataLancamento}
                                        </span>
                                    </div>

                                    <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.4;">
                                        ${sinopse}
                                    </p>

                                    <div style="margin-top: 10px; font-size: 12px; color: #6c757d;">
                                        ID TMDB: ${item.id}<br>
                                        <a href="https://www.themoviedb.org/${isSerie ? 'tv' : 'movie'}/${item.id}" target="_blank" style="color: #17a2b8; font-size: 11px; text-decoration: underline;"> 🔍 Ver no TMDB</a>
                                        <span style="margin: 0 5px;">|</span>
                                        <a href="${justwatchLink}" target="_blank" style="color: #28a745; font-size: 11px; text-decoration: underline;">Ver no JustWatch</a>
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; margin-left: 10px; gap: 5px;">
                                    <button class="tmdb-ver-site-btn"
                                            data-id="${item.id}"
                                            data-type="${isSerie ? 'tv' : 'movie'}"
                                            style="background: #17a2b8; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.3s; font-size: 12px;"
                                            onmouseover="this.style.background='#138496'"
                                            onmouseout="this.style.background='#17a2b8'">
                                        Site
                                    </button>
                                    <button class="tmdb-selecionar-btn"
                                            data-id="${item.id}"
                                            style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.3s;"
                                            onmouseover="this.style.background='#218838'"
                                            onmouseout="this.style.background='#28a745'">
                                        Selecionar
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${resultados.length >= 5 ? `
                    <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
                        <p style="margin: 0; color: #856404; font-size: 14px;">
                            ℹ️ Mostrando os 5 primeiros resultados. Se não encontrar o que procura, tente ser mais específico no nome.
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Função para criar o HTML das informações (popup)
    function criarHTMLInfo(infoItem, tipo, providers) {
        if (!infoItem) {
            return '<p>Informações não encontradas no TMDB</p>';
        }

        const posterUrl = infoItem.poster_path
            ? `https://image.tmdb.org/t/p/w500${infoItem.poster_path}`
            : '';

        const dataLancamento = infoItem.release_date || infoItem.first_air_date
            ? new Date(infoItem.release_date || infoItem.first_air_date).toLocaleDateString('pt-BR')
            : 'Data não disponível';

        const nota = infoItem.vote_average
            ? Number(infoItem.vote_average).toFixed(1)
            : 'N/A';

        const sinopse = infoItem.overview
            ? infoItem.overview
            : 'Sinopse não disponível';

        const titulo = tipo === 'Série' ? infoItem.name : infoItem.title;
        // CORREÇÃO AQUI: usar infoItem.release_date/infoItem.first_air_date em vez de 'item'
        const ano = infoItem.release_date || infoItem.first_air_date
            ? new Date(infoItem.release_date || infoItem.first_air_date).getFullYear()
            : 'N/A';

        const justwatchLink = criarLinkJustWatch(titulo);

        // Processar provedores de streaming para o popup
        let providersHTML = '';
        if (providers && providers.results && providers.results.BR) {
            const brProviders = providers.results.BR;

            const criarSecaoProvedores = (tituloSecao, lista, cor) => {
                if (lista && lista.length > 0) {
                    return `
                        <div style="margin-top: 15px;">
                            <h4 style="color: #495057; margin: 0 0 10px 0;">${tituloSecao}</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                ${lista.map(provider => `
                                    <div style="display: flex; align-items: center; background: ${cor}; padding: 5px 10px; border-radius: 4px;">
                                        <img src="https://image.tmdb.org/t/p/w45${provider.logo_path}"
                                             alt="${provider.provider_name}"
                                             style="width: 24px; height: 24px; margin-right: 8px; border-radius: 4px;">
                                        <span style="font-size: 14px;">${provider.provider_name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
                return '';
            };

            providersHTML += criarSecaoProvedores('Disponível em:', brProviders.flatrate, '#f8f9fa');
            providersHTML += criarSecaoProvedores('Disponível para compra em:', brProviders.buy, '#e9ecef');
            providersHTML += criarSecaoProvedores('Disponível para aluguel em:', brProviders.rent, '#e3f2fd');
        }

        return `
            <div class="tmdb-info" style="font-family: Arial, sans-serif;">
                <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 20px;">
                    ${posterUrl ? `
                        <div style="flex-shrink: 0;">
                            <img src="${posterUrl}"
                                 alt="${titulo}"
                                 style="max-width: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        </div>
                    ` : ''}

                    <div style="flex-grow: 1;">
                        <h3 style="color: #007bff; font-size: 24px; margin: 0 0 10px 0;">
                            ${titulo} <span style="color: #6c757d; font-size: 18px;">(${ano})</span>
                        </h3>

                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                                <div>
                                    <p style="margin: 0; font-size: 16px; color: #ff6b00; font-weight: bold;">
                                        ⭐ ${nota}/10
                                    </p>
                                </div>
                                <div>
                                    <p style="margin: 0; font-size: 16px; color: #007bff; font-weight: bold;">
                                        📅 ${dataLancamento}
                                    </p>
                                </div>
                                <div>
                                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                                        ID TMDB: ${infoItem.id}<br>
                                        <a href="https://www.themoviedb.org/${tipo === 'Série' ? 'tv' : 'movie'}/${infoItem.id}" target="_blank" style="color: #17a2b8; font-size: 12px; text-decoration: underline;">🔍 Ver no TMDB</a>
                                    </p>
                                </div>
                                <div>
                                    <p style="margin: 0; font-size: 14px;">
                                        <a href="${justwatchLink}" target="_blank" style="color: #28a745; font-size: 12px; text-decoration: underline; font-weight: bold;">
                                            🔍 Ver no JustWatch
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 15px;">
                    <h4 style="color: #495057; margin: 0 0 10px 0; font-size: 18px;">Sinopse:</h4>
                    <p style="line-height: 1.5; color: #212529; font-size: 16px;">${sinopse}</p>
                </div>

                ${providersHTML}

                ${popupState.resultados && popupState.resultados.length > 1 ? `
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6; text-align: center;">
                        <button class="tmdb-voltar-selecao"
                                style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            ↩️ Voltar para a lista de resultados
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Estilos CSS
    const styles = `
        .tmdb-popup {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 700px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        .tmdb-popup.active {
            display: block;
        }
        .tmdb-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0,0,0,0.5);
            z-index: 9999;
        }
        .tmdb-overlay.active {
            display: block;
        }
        .tmdb-close {
            position: absolute;
            top: 10px;
            right: 10px;
            cursor: pointer;
            font-size: 24px;
            color: #666;
            background: none;
            border: none;
            padding: 5px;
            line-height: 1;
            z-index: 10001;
        }
        .tmdb-button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin: 8px 0;
            transition: background-color 0.3s;
            font-weight: bold;
        }
        .tmdb-button:hover {
            background-color: #0056b3;
        }
        .tmdb-button.loading {
            background-color: #6c757d;
            cursor: wait;
        }
        .loading-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid #fff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s linear infinite;
            margin-right: 5px;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .tmdb-container {
            text-align: center;
            margin: 5px 0;
        }
        .tmdb-resultado-item {
            transition: all 0.3s ease;
        }
        .tmdb-resultado-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .tmdb-selecionar-btn:hover {
            transform: scale(1.05);
        }
    `;

    // Adicionar estilos
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Sistema de popup com histórico
    let popupState = {
        titulo: '',
        tipo: '',
        resultados: [],
        selecionado: null
    };

    function criarElementosPopup() {
        if (document.querySelector('.tmdb-overlay')) return;

        const container = document.createElement('div');
        container.innerHTML = `
            <div class="tmdb-overlay"></div>
            <div class="tmdb-popup">
                <button class="tmdb-close">&times;</button>
                <div class="tmdb-content"></div>
            </div>
        `;
        document.body.appendChild(container);

        document.querySelector('.tmdb-close').addEventListener('click', fecharPopup);
        document.querySelector('.tmdb-overlay').addEventListener('click', fecharPopup);
    }

    function mostrarPopup(conteudo, titulo = '', tipo = '') {
        const popup = document.querySelector('.tmdb-popup');
        const overlay = document.querySelector('.tmdb-overlay');
        const content = document.querySelector('.tmdb-content');

        if (!popup || !overlay || !content) {
            criarElementosPopup();
            return mostrarPopup(conteudo, titulo, tipo);
        }

        content.innerHTML = conteudo;
        popup.classList.add('active');
        overlay.classList.add('active');

        // Atualizar estado
        if (titulo && tipo) {
            popupState.titulo = titulo;
            popupState.tipo = tipo;
        }
    }

    function fecharPopup() {
        const popup = document.querySelector('.tmdb-popup');
        const overlay = document.querySelector('.tmdb-overlay');

        if (popup) popup.classList.remove('active');
        if (overlay) overlay.classList.remove('active');

        // Limpar estado
        popupState = {
            titulo: '',
            tipo: '',
            resultados: [],
            selecionado: null
        };
    }

    // Função para carregar detalhes do item selecionado
    async function carregarDetalhesItem(id, tipo, itemInfo) {
        try {
            // Buscar provedores de streaming
            const providers = await buscarProvedoresTMDB(id, tipo === 'Série' ? 'tv' : 'movie');

            // Mostrar informações detalhadas
            mostrarPopup(criarHTMLInfo(itemInfo, popupState.tipo, providers));

            // Adicionar evento para o botão de voltar
            setTimeout(() => {
                const voltarBtn = document.querySelector('.tmdb-voltar-selecao');
                if (voltarBtn) {
                    voltarBtn.addEventListener('click', () => {
                        mostrarPopup(criarHTMLSelecao(popupState.resultados, popupState.tipo));
                        adicionarEventosSelecao();
                    });
                }
            }, 100);

        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            mostrarPopup('<p style="color: #dc3545;">❌ Erro ao carregar informações detalhadas.</p>');
        }
    }

    // Função para adicionar eventos aos botões de seleção
    function adicionarEventosSelecao() {
        // Adicionar eventos aos botões de seleção
        document.querySelectorAll('.tmdb-selecionar-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();

                const id = btn.getAttribute('data-id');
                const itemElement = btn.closest('.tmdb-resultado-item');
                const index = itemElement ? itemElement.getAttribute('data-index') : 0;
                const itemInfo = popupState.resultados[index];

                if (itemInfo) {
                    // Mostrar loading
                    const popupContent = document.querySelector('.tmdb-content');
                    popupContent.innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div class="loading-spinner" style="width: 40px; height: 40px; border-width: 4px; margin: 0 auto 20px;"></div>
                            <p style="color: #007bff; font-size: 16px;">Carregando informações detalhadas...</p>
                        </div>
                    `;

                    // Carregar detalhes
                    await carregarDetalhesItem(id, popupState.tipo, itemInfo);
                }
            });
        });

        // Adicionar eventos aos botões "Site"
        document.querySelectorAll('.tmdb-ver-site-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();

                const id = btn.getAttribute('data-id');
                const type = btn.getAttribute('data-type'); // 'tv' ou 'movie'

                // Abrir a página do item no TMDB em uma nova aba
                const tmdbUrl = `https://www.themoviedb.org/${type}/${id}`;
                window.open(tmdbUrl, '_blank');
            });
        });

        // Adicionar evento de clique em todo o item
        document.querySelectorAll('.tmdb-resultado-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.tmdb-selecionar-btn') && !e.target.closest('.tmdb-ver-site-btn') && !e.target.closest('a')) {
                    const btn = item.querySelector('.tmdb-selecionar-btn');
                    if (btn) btn.click();
                }
            });
        });
    }

    // Função para adicionar botão TMDB a um card
    function adicionarBotaoTMDB(card) {
        // Verificar se o botão já existe
        if (card.querySelector('.tmdb-container')) {
            console.log('Botão TMDB já existe para este card');
            return;
        }

        // Obter título e tipo do card
        const cardTitleElement = card.querySelector('.card-title');
        const cardInfoElements = card.querySelectorAll('.info-item');

        if (!cardTitleElement) {
            console.log('Não foi encontrado elemento .card-title neste card');
            return;
        }

        const titulo = cardTitleElement.textContent.trim();

        let tipo = 'Série'; // Valor padrão
        cardInfoElements.forEach(element => {
            const text = element.textContent;
            if (text.includes('Tipo:')) {
                if (text.includes('Filme')) {
                    tipo = 'Filme';
                } else if (text.includes('Série')) {
                    tipo = 'Série';
                }
            }
        });

        console.log(`Adicionando botão TMDB para: ${titulo} (${tipo})`);

        // Criar container para o botão
        const tmdbContainer = document.createElement('div');
        tmdbContainer.className = 'tmdb-container';
        tmdbContainer.style.cssText = 'text-align: center; margin: 5px 0;';

        // Criar botão com texto
        const botao = document.createElement('button');
        botao.className = 'tmdb-button';
        botao.textContent = '🔍 Ver no TMDB';
        botao.style.cssText = `
            background-color: #007bff;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin: 8px 0;
            transition: background-color 0.3s;
            font-weight: bold;
        `;

        // Adicionar evento ao botão
        botao.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            botao.classList.add('loading');
            botao.innerHTML = '<span class="loading-spinner"></span>Carregando...';

            try {
                // Buscar informações do TMDB (múltiplos resultados)
                const resultados = await buscarInformacoesTMDB(titulo, tipo);

                if (resultados.length === 0) {
                    // Nenhum resultado encontrado
                    mostrarPopup('<p style="color: #dc3545; text-align: center; padding: 40px;">❌ Nenhum resultado encontrado no TMDB</p>');
                    botao.textContent = '❌ Não encontrado';
                } else if (resultados.length === 1) {
                    // Apenas um resultado - mostrar direto
                    popupState.resultados = resultados;
                    popupState.titulo = titulo;
                    popupState.tipo = tipo;

                    const itemInfo = resultados[0];
                    const providers = await buscarProvedoresTMDB(itemInfo.id, tipo === 'Série' ? 'tv' : 'movie');

                    mostrarPopup(criarHTMLInfo(itemInfo, tipo, providers), titulo, tipo);
                    botao.textContent = '✅ Informações carregadas';
                } else {
                    // Múltiplos resultados - mostrar seleção
                    popupState.resultados = resultados;
                    popupState.titulo = titulo;
                    popupState.tipo = tipo;

                    mostrarPopup(criarHTMLSelecao(resultados, tipo), titulo, tipo);
                    adicionarEventosSelecao();
                    botao.textContent = '🔍 Ver novamente';
                }

                // Restaurar botão após algum tempo
                setTimeout(() => {
                    if (resultados.length > 0) {
                        botao.textContent = '🔍 Ver novamente';
                    } else {
                        botao.textContent = '🔍 Tentar novamente';
                    }
                }, 3000);

            } catch (error) {
                console.error(`Erro ao buscar informações para "${titulo}":`, error);
                botao.textContent = '❌ Erro ao carregar';
                setTimeout(() => {
                    botao.textContent = '🔍 Tentar novamente';
                }, 2000);

                mostrarPopup(`
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: #dc3545; font-size: 18px; margin-bottom: 20px;">❌ Erro ao buscar informações do TMDB</p>
                        <p style="color: #666; margin-bottom: 10px;">Detalhes do erro:</p>
                        <p style="color: #999; font-size: 14px; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                            ${error.message || 'Erro desconhecido'}
                        </p>
                    </div>
                `);
            } finally {
                botao.classList.remove('loading');
            }
        });

        // Adicionar botão ao container
        tmdbContainer.appendChild(botao);

        // Inserir no card - tenta em múltiplos locais para garantir visibilidade
        const cardActions = card.querySelector('.card-actions');
        const cardHeader = card.querySelector('.card-header');

        if (cardActions) {
            // Insere antes das ações (onde os botões de aprovar/rejeitar estão)
            card.insertBefore(tmdbContainer, cardActions);
        } else if (cardHeader) {
            // Se não encontrar .card-actions, insere após o cabeçalho
            cardHeader.parentNode.insertBefore(tmdbContainer, cardHeader.nextSibling);
        } else {
            // Se não encontrar nem header nem actions, adiciona no final do card
            card.appendChild(tmdbContainer);
        }

        console.log(`Botão TMDB adicionado ao card com título: ${titulo}`);
    }

    // Adicionar botões TMDB aos cards existentes
    function adicionarBotoesAosCards() {
        // Tenta encontrar cards com diferentes seletores para maior compatibilidade
        let cards = document.querySelectorAll('.solicitacao-card:not([style*="display: none"])');

        // Se não encontrar com o seletor original, tenta sem a restrição de estilo
        if (cards.length === 0) {
            cards = document.querySelectorAll('.solicitacao-card');
        }

        // Se ainda não encontrar, tenta seletores mais genéricos
        if (cards.length === 0) {
            cards = document.querySelectorAll('.solicitacoes article, [class*="solicitacao"][class*="card"]');
        }

        console.log(`Encontrados ${cards.length} cards para adicionar botões`);

        // Contador para verificar quantos botões foram realmente adicionados
        let botoesAdicionados = 0;

        cards.forEach(card => {
            // Verifica se o botão já existe antes de adicionar
            if (!card.querySelector('.tmdb-container')) {
                adicionarBotaoTMDB(card);
                botoesAdicionados++;
            } else {
                // Mesmo que o container já exista, vamos garantir que o botão tem o texto correto
                const botaoExistente = card.querySelector('.tmdb-button');
                if (botaoExistente && botaoExistente.textContent !== '🔍 Ver no TMDB') {
                    botaoExistente.textContent = '🔍 Ver no TMDB';
                }
            }
        });

        console.log(`Botões adicionados a ${botoesAdicionados} cards`);
    }

    // Inicializar script
    function inicializar() {
        console.log('=== Inicializando script TMDB ===');
        criarElementosPopup();

        // Faz múltiplas tentativas para garantir que os botões sejam adicionados
        setTimeout(() => {
            console.log('Primeira tentativa de adicionar botões...');
            adicionarBotoesAosCards();
        }, 1000);

        setTimeout(() => {
            console.log('Segunda tentativa de adicionar botões...');
            adicionarBotoesAosCards();
        }, 3000);

        setTimeout(() => {
            console.log('Terceira tentativa de adicionar botões...');
            adicionarBotoesAosCards();
        }, 5000);

        console.log('Script TMDB inicializado');
    }

    // Executar quando a página carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        // Se o DOM já estiver carregado, executar imediatamente
        setTimeout(inicializar, 500);
    }

    // Observar mudanças na página para novos cards
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;

        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 &&
                        (node.classList && node.classList.contains('solicitacao-card') ||
                         node.querySelector && node.querySelector('.solicitacao-card'))) {
                        shouldProcess = true;
                    }
                });
            }
        });

        if (shouldProcess) {
            console.log('Detectado novo(s) card(s), adicionando botões...');
            setTimeout(adicionarBotoesAosCards, 100);
        }
    });

    // Iniciar observação
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Adicionar listener para os botões de status e categoria
    document.addEventListener('click', function(e) {
        if (e.target.classList &&
            (e.target.classList.contains('status-btn') ||
             e.target.classList.contains('categoria-btn'))) {
            console.log('Clicado em botão de status/categoria, atualizando cards...');
            setTimeout(adicionarBotoesAosCards, 500);
        }
    });

    console.log('TMDB Info Script Carregado (Múltiplos Resultados) - Versão 2.6 - Adicionado link JustWatch');
})();