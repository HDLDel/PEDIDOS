// ==UserScript==
// @name         Botões Integrados de Preenchimento de Motivo ATIVO
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Adiciona botões de preenchimento ao lado do campo Motivo da Rejeição
// @match        https://pedidos.imperioapps.top/*
// @match        https://*.pedidos.imperioapps.top/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Funções para preencher o motivo
    function preencherrepetido() {
        const motivoField = document.getElementById('motivo_rejeicao');
        if (motivoField) {
            motivoField.value = 'Pedido Repetido.\n\nFavor não repetir os pedidos para não congestionar a fila.';
            motivoField.focus();
        }
    }

    function preencherAntigo() {
        const categoriaField = document.getElementById('rejeitar-current-category');
        const motivoField = document.getElementById('motivo_rejeicao');

        if (categoriaField && motivoField) {
            const categoria = categoriaField.value.trim().toLowerCase();

            if (categoria === 'filme') {
                motivoField.value = `Informamos que, por critérios de qualidade técnica e de padronização do acervo, FILMES produzidos antes do ano de 2000 têm baixíssima ou zero prioridade na fila de adição.

Filmes anteriores a 1980 serão rejeitados.

Essa medida se faz necessária devido a limitações relacionadas à disponibilidade da mídia, resolução de imagem, formatos e compatibilidade com os padrões atuais de reprodução, garantindo assim uma melhor experiência ao público.

Agradecemos a compreensão.`;
            } else if (categoria === 'série') {
                motivoField.value = `Informamos que, por critérios de qualidade técnica e de padronização do acervo, SÉRIES produzidas antes do ano de 2000 têm baixíssima ou zero prioridade na fila de adição.

Séries muito antigas serão rejeitadas.

Essa medida se faz necessária devido a limitações relacionadas à disponibilidade da mídia, resolução de imagem, formatos e compatibilidade com os padrões atuais de reprodução, garantindo assim uma melhor experiência ao público.

Agradecemos a compreensão.`;
            } else {
                motivoField.value = `Informamos que, por critérios de qualidade técnica e de padronização do acervo, CONTEÚDOS produzidos antes do ano de 2000 têm baixíssima ou zero prioridade na fila de adição.

Essa medida se faz necessária devido a limitações relacionadas à disponibilidade da mídia, resolução de imagem, formatos e compatibilidade com os padrões atuais de reprodução, garantindo assim uma melhor experiência ao público.

Agradecemos a compreensão.`;
            }

            motivoField.focus();
        }
    }

    function preencherIndisponivel() {
        const motivoField = document.getElementById('motivo_rejeicao');
        if (motivoField) {
            motivoField.value = 'Conteúdo Indisponível dublado ou legendado.';
            motivoField.focus();
        }
    }

    // >>> NOVA FUNÇÃO: Botão ERRO <<<
    function preencherErro() {
        const motivoField = document.getElementById('motivo_rejeicao');
        if (motivoField) {
            motivoField.value = `Poderia fornecer detalhes adicionais sobre o erro?

Preciso identificar a obra (filme ou série), o número do episódio e o momento exato da falha.

Por exemplo: 'No filme X ou no episódio Y da 1ª temporada, ocorre um erro a partir dos 10:30'.

Além disso, descreva o que aparece na tela (código de erro, travamento ou tela preta).`;
            motivoField.focus();
        }
    }

    function preencherJaConsta() {
        const motivoField = document.getElementById('motivo_rejeicao');
        if (motivoField) {
            motivoField.value = 'Já Consta no Servidor.\n\nFavor pesquisar nas categorias All ou todos em nas categorias individuais antes de solicitar os conteúdos.';
            motivoField.focus();
        }
    }

    function preencherExterno() {
        const motivoField = document.getElementById('motivo_rejeicao');
        if (motivoField) {
            motivoField.value = `Erro de reprodução normalmente é codec do aplicativo em versões muito antigas.

Como Configurar o VLC PLAYER EXTERNO:

Vá para Configurações do aplicativo (Settings) onde tem um simbolo de engrenagem.

Procure por "Player" ou "Player Padrão", "Jogador externo" ou "Leitor externo".

Selecione "VLC" ou "Player Externo".

Salve as configurações.

Quando abrir um canal ou filme ou serie, escolha "VLC" na lista de apps.

Marque "Sempre" para definir como padrão.

Se não tiver instalado o VLC a playstore vai se abrir.

Instale o VLC Media Player da Play Store.

Tente abrir um canal ou filme ou serie, escolha "VLC" na lista de apps.`;
            motivoField.focus();
        }
    }

    function preencherRecente() {
        const motivoField = document.getElementById('motivo_rejeicao');
        if (motivoField) {
            motivoField.value = 'Filme lançado recentemente no Cinema.\n\nSomente disponível em 1080 FullHD depois de 3 a 5 meses ao sair nos Streamings.\n\nFavor aguardar, o conteúdo será atualizado automaticamente.';
            motivoField.focus();
        }
    }

    // Função para criar os botões integrados ao formulário
    function criarBotoesIntegrados() {
        const labels = document.querySelectorAll('label');
        let motivoLabel = null;

        labels.forEach(label => {
            if (label.textContent.toLowerCase().includes('motivo')) {
                motivoLabel = label;
            }
        });

        if (motivoLabel && !document.getElementById('botoesPreencherContainer')) {
            const container = motivoLabel.parentElement;

            const botoesContainer = document.createElement('div');
            botoesContainer.id = 'botoesPreencherContainer';
            botoesContainer.style.cssText = `
                display: flex;
                gap: 8px;
                margin-top: 8px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            `;

            // Botão REPETIDO
            const botaorepetido = document.createElement('button');
            botaorepetido.type = 'button';
            botaorepetido.className = 'btn btn-sm btn-outline-primary';
            botaorepetido.innerHTML = 'REPETIDO';
            botaorepetido.onclick = preencherrepetido;

            // Botão Antigo
            const botaoAntigo = document.createElement('button');
            botaoAntigo.type = 'button';
            botaoAntigo.className = 'btn btn-sm btn-outline-secondary';
            botaoAntigo.innerHTML = 'Antigo';
            botaoAntigo.onclick = preencherAntigo;

            // Botão Indisponível
            const botaoIndisponivel = document.createElement('button');
            botaoIndisponivel.type = 'button';
            botaoIndisponivel.className = 'btn btn-sm btn-outline-danger';
            botaoIndisponivel.innerHTML = 'Indisponível';
            botaoIndisponivel.onclick = preencherIndisponivel;

            // >>> BOTÃO SUBSTITUÍDO: 4K → ERRO <<<
            const botaoErro = document.createElement('button');
            botaoErro.type = 'button';
            botaoErro.className = 'btn btn-sm btn-outline-info';
            botaoErro.innerHTML = 'Erro';
            botaoErro.title = 'Solicitar detalhes técnicos do erro reportado';
            botaoErro.onclick = preencherErro;

            // Botão Já Consta no Servidor
            const botaoJaConsta = document.createElement('button');
            botaoJaConsta.type = 'button';
            botaoJaConsta.className = 'btn btn-sm btn-outline-warning';
            botaoJaConsta.innerHTML = 'Já Consta no Servidor';
            botaoJaConsta.title = 'PESQUISAR.';
            botaoJaConsta.onclick = preencherJaConsta;
            botaoJaConsta.style.whiteSpace = 'normal';
            botaoJaConsta.style.textAlign = 'center';
            botaoJaConsta.style.lineHeight = '1.2';
            botaoJaConsta.style.padding = '4px 8px';

            // Botão Externo
            const botaoExterno = document.createElement('button');
            botaoExterno.type = 'button';
            botaoExterno.className = 'btn btn-sm btn-outline-success';
            botaoExterno.innerHTML = 'Externo';
            botaoExterno.title = 'Instruções para configurar o VLC Player Externo para resolver problemas de codec';
            botaoExterno.onclick = preencherExterno;
            botaoExterno.style.whiteSpace = 'normal';
            botaoExterno.style.textAlign = 'center';
            botaoExterno.style.lineHeight = '1.2';
            botaoExterno.style.padding = '4px 8px';

            // Botão Recentemente no Cinema
            const botaoRecente = document.createElement('button');
            botaoRecente.type = 'button';
            botaoRecente.className = 'btn btn-sm btn-outline-dark';
            botaoRecente.innerHTML = 'Recente';
            botaoRecente.onclick = preencherRecente;
            botaoRecente.style.whiteSpace = 'normal';
            botaoRecente.style.textAlign = 'center';
            botaoRecente.style.lineHeight = '1.2';
            botaoRecente.style.padding = '4px 8px';

            // Adicionar todos os botões ao container (ordem atualizada)
            botoesContainer.appendChild(botaorepetido);
            botoesContainer.appendChild(botaoAntigo);
            botoesContainer.appendChild(botaoIndisponivel);
            botoesContainer.appendChild(botaoErro);        // ← Substituiu o 4K
            botoesContainer.appendChild(botaoJaConsta);
            botoesContainer.appendChild(botaoExterno);
            botoesContainer.appendChild(botaoRecente);

            // Inserir o container após o label do motivo (com fallback seguro)
            if (motivoLabel.nextSibling) {
                container.insertBefore(botoesContainer, motivoLabel.nextSibling);
            } else {
                container.appendChild(botoesContainer);
            }

            // Estilos para hover dos botões (injeção única)
            if (!document.getElementById('botoesHoverStyle')) {
                const estilo = document.createElement('style');
                estilo.id = 'botoesHoverStyle';
                estilo.textContent = `
                    #botoesPreencherContainer button:hover {
                        color: white;
                    }
                    #botoesPreencherContainer button:nth-child(1):hover {
                        background-color: #007bff;
                    }
                    #botoesPreencherContainer button:nth-child(2):hover {
                        background-color: #6c757d;
                    }
                    #botoesPreencherContainer button:nth-child(3):hover {
                        background-color: #dc3545;
                    }
                    #botoesPreencherContainer button:nth-child(4):hover {
                        background-color: #17a2b8;
                    }
                    #botoesPreencherContainer button:nth-child(5):hover {
                        background-color: #ffc107;
                        color: #212529;
                    }
                    #botoesPreencherContainer button:nth-child(6):hover {
                        background-color: #28a745;
                    }
                    #botoesPreencherContainer button:nth-child(7):hover {
                        background-color: #343a40;
                    }
                `;
                document.head.appendChild(estilo);
            }
        }
    }

    const observer = new MutationObserver(function() {
        if (document.getElementById('motivo_rejeicao')) {
            criarBotoesIntegrados();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    criarBotoesIntegrados();
})();