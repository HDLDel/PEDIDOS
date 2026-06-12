# TODO - Frontend VOD Premium

## Fase 1: Dados Mockados Completos
- [x] Expandir `models/RequestModel.js` com campos completos:
  - `whatsapp`, `email`, `description` (motivo do pedido), `errorDescription` (para reportes de erro)
  - `requestType` (solicitar conteúdo, temporada, episódio, erro de reprodução)
  - `year` (ano da obra), `episode` (número do episódio)
  - `rejectionReason` (motivo da rejeição, quando aplicável)
  - `adminAction` (quem aprovou/rejeitou)
  - `actionDate` (data da ação)
- [ ] Aumentar volume de dados mockados para ~30 registros variados
- [ ] Adicionar métodos auxiliares ao model (filtro por status, busca por texto)
- [x] Implementar autenticação para o Painel Admin (com sessão)

## Fase 2: Dashboard Completo (EJS)
- [ ] Header premium com logo, estatísticas completas (Pendentes/Aprovados/Rejeitados em cards)
- [ ] Barra de ferramentas com:
  - Busca por título/revendedor
  - Filtros por status (tabs: Todos/Pendentes/Aprovados/Rejeitados)
  - Filtros por categoria (Filmes/Séries)
  - Contador de resultados
- [ ] Cards de solicitação completos com:
  - Poster da obra
  - Badge de tipo (Filme/Série) com ícone
  - Badge de status (Pendente/Aprovado/Rejeitado) com cor
  - Título, ano, temporada/episódio
  - Dados do solicitante: nome, WhatsApp (mascarado), data
  - Descrição do pedido/erro (com tooltip ou expandir)
  - Se rejeitado: motivo da rejeição visível
  - Botões de ação: Aprovar, Rejeitar, Bloquear Solicitante, TMDB
- [ ] Paginação (12 cards por página)
- [ ] Mensagem de "nenhum resultado encontrado"

## Fase 3: Modal de Rejeição
- [ ] Modal estilizado com overlay
- [ ] Campo textarea para motivo da rejeição
- [ ] Botões de atalho de preenchimento automático:
  - REPETIDO, Antigo, Indisponível, Erro, Já Consta no Servidor, Externo, Recente
- [ ] Botão "Confirmar Rejeição" e "Cancelar"
- [ ] Preview da mensagem que será enviada

## Fase 4: Modal TMDB
- [ ] Modal com busca simulada ao TMDB
- [ ] Lista de resultados com poster, título, ano, nota
- [ ] Link para JustWatch
- [ ] Botão "Ver no TMDB" (abre em nova aba)

## Fase 8: Painel do Revendedor
- [x] Criar views em `views/revenda/` (login, register, dashboard)
- [x] Sistema de Login/Cadastro (Interface)
- [x] Busca TMDB integrada no painel do revendedor
- [x] Fluxo de seleção de obra -> Detalhamento do pedido
- [x] Campo condicional para Reporte de Erro técnico
- [ ] Visualização de status dos pedidos enviados

## Fase 5: Estilização Completa (CSS)
- [ ] Variáveis CSS expandidas (cores de status, espaçamentos)
- [ ] Estilos para header, filtros, cards, badges
- [ ] Estilos para modais (overlay, animações)
- [ ] Estilos para paginação
- [ ] Responsividade mobile
- [ ] Hover effects e transições

## Fase 6: Interatividade (JavaScript inline)
- [ ] Filtro por status (tabs clicáveis)
- [ ] Filtro por categoria
- [ ] Busca em tempo real (client-side)
- [ ] Abrir/fechar modais
- [ ] Preenchimento automático do campo de rejeição
- [ ] Paginação client-side
- [ ] Toggle para expandir descrição longa

## Fase 7: Teste Visual
- [ ] Rodar servidor e verificar visualmente
- [ ] Ajustes finos de espaçamento, cores, tipografia
