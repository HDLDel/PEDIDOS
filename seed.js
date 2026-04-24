import db from './db.js';
import { ResellerModel } from './models/ResellerModel.js';
import { RequestModel } from './models/RequestModel.js';
import { TmdbModel } from './models/TmdbModel.js';

console.log('🌱 Iniciando seed do banco de dados...');

// Verificar se já tem dados
const count = db.prepare('SELECT COUNT(*) as count FROM resellers').get();
if (count.count > 0) {
  console.log('✅ Banco já populado. Pulando seed.');
  process.exit(0);
}

// Dados dos revendedores
const resellersData = [
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(11) 97125-8661', whatsapp: '(11) 97125-8661', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(24) 98132-9657', whatsapp: '(24) 98132-9657', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>@email.com', phone: '(79) 99979-4935', whatsapp: '(79) 99979-4935', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(11) 98765-4321', whatsapp: '(11) 98765-4321', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(21) 99876-5432', whatsapp: '(21) 99876-5432', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(31) 98765-<SENHA>4', whatsapp: '(31) 98765-<SENHA>4', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(41) 99988-7766', whatsapp: '(41) 99988-7766', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(51) 98877-6655', whatsapp: '(51) 98877-6655', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(61) 97766-5544', whatsapp: '(61) 97766-5544', password: '<SENHA>' },
  { name: '<DADO_SEED>', email: '<DADO_SEED>', phone: '(71) 96655-4433', whatsapp: '(71) 96655-4433', password: '<SENHA>' }
];

// Criar revendedores e mapear nome -> id
const resellerMap = {};
for (const r of resellersData) {
  const created = ResellerModel.create(r);
  resellerMap[r.name] = created.id;
  console.log(`  👤 Revendedor: ${r.name} (ID: ${created.id})`);
}

// Dados dos pedidos (30 registros)
const requestsData = [
  { title: 'The Pitt', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '2', episode: '13- 14- 15', requestType: 'content', description: 'Solicitação de novos episódios', date: '23/04/2026', time: '14:40', year: '2025', poster: 'https://image.tmdb.org/t/p/w500/kvFSpESyBZMjaeOJDx7RS3P1jey.jpg' },
  { title: 'Euphoria', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '3', episode: '2', requestType: 'content', description: 'Nova temporada disponível', date: '23/04/2026', time: '00:16', year: '2019', poster: 'https://image.tmdb.org/t/p/w500/r996Y9AtS0Ysa4g9BD6nu9p6uXU.jpg' },
  { title: 'Desenhos Animados do Velho Testamento', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Série completa solicitada', date: '21/04/2026', time: '14:15', year: '1995', poster: 'https://image.tmdb.org/t/p/w500/7I9f5Zunp9vX6R96m7S904v2Dzh.jpg' },
  { title: 'Desenhos Animados do Novo Testamento', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Série completa solicitada', date: '21/04/2026', time: '14:15', year: '1996', poster: 'https://image.tmdb.org/t/p/w500/8GxvA9zDZ9G0ui3Y2f3P3znARvU.jpg' },
  { title: 'The Pitt', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '2', episode: '15', requestType: 'content', description: 'Solicitação de episódio', date: '21/04/2026', time: '13:50', year: '2025', poster: 'https://image.tmdb.org/t/p/w500/kvFSpESyBZMjaeOJDx7RS3P1jey.jpg' },
  { title: 'Duna: Parte 2', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Filme em alta demanda', date: '24/04/2024', time: '10:30', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/7I9f5Zunp9vX6R96m7S904v2Dzh.jpg' },
  { title: 'Oppenheimer', type: 'movie', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Filme solicitado por diversos clientes', date: '23/04/2024', time: '16:45', year: '2023', poster: 'https://image.tmdb.org/t/p/w500/8GxvA9zDZ9G0ui3Y2f3P3znARvU.jpg' },
  { title: 'Shogun', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Série premiada', date: '23/04/2024', time: '09:15', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/7O4SvpRBhZ7Z40P9iNEpS90gYFc.jpg' },
  { title: 'Godzilla x Kong: O Novo Império', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Blockbuster recente', date: '23/04/2024', time: '14:20', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/bQ2ywkqc6XmS7vznjC4nyUNBFEv.jpg' },
  { title: 'The Boys', type: 'series', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '4', requestType: 'content', description: 'Quarta temporada', date: '22/04/2024', time: '11:00', year: '2019', poster: 'https://image.tmdb.org/t/p/w500/799986326164619.jpg' },
  { title: 'Rebel Moon - Parte 2', type: 'movie', status: 'rejected', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Conteúdo indisponível', date: '22/04/2024', time: '18:30', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/8fI9Scl0qS9XmYmO7p6uS3.jpg' },
  { title: 'Guerra Civil', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Filme de ação', date: '22/04/2024', time: '08:45', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/sh7E6Zv0n9vX6R96m7S904v2Dzh.jpg' },
  { title: "X-Men '97", type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Série animada', date: '21/04/2024', time: '13:20', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/966Y9AtS0Ysa4g9BD6nu9p6uXU.jpg' },
  { title: 'Pobres Criaturas', type: 'movie', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Filme indie', date: '21/04/2024', time: '15:00', year: '2023', poster: 'https://image.tmdb.org/t/p/w500/k99Xf999999999999999999999.jpg' },
  { title: 'The Bear', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '2', requestType: 'content', description: 'Segunda temporada', date: '21/04/2024', time: '10:10', year: '2022', poster: 'https://image.tmdb.org/t/p/w500/r9Xf999999999999999999999.jpg' },
  { title: 'Kung Fu Panda 4', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Animação familiar', date: '20/04/2024', time: '17:00', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/kDpIEAX9f6topq9ICN3UMsYp4S7.jpg' },
  { title: 'Ripley', type: 'series', status: 'rejected', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Já consta no servidor', date: '20/04/2024', time: '12:30', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/6yvScl0qS9XmYmO7p6uS3.jpg' },
  { title: 'Wonka', type: 'movie', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Musical', date: '20/04/2024', time: '19:00', year: '2023', poster: 'https://image.tmdb.org/t/p/w500/8GxvA9zDZ9G0ui3Y2f3P3znARvU.jpg' },
  { title: 'Fallout', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Baseado no jogo', date: '19/04/2024', time: '14:00', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/r996Y9AtS0Ysa4g9BD6nu9p6uXU.jpg' },
  { title: 'O Senhor dos Anéis: Os Anéis de Poder', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '2', requestType: 'content', description: 'Série épica', date: '19/04/2024', time: '09:30', year: '2022', poster: 'https://image.tmdb.org/t/p/w500/2fGWfUS5YJx82BUkAz0YhnhEqeo.jpg' },
  { title: 'Deadpool & Wolverine', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Marvel', date: '18/04/2024', time: '16:00', year: '2024', poster: 'https://image.tmdb.org/t/p/w500/2FYFBgdNVVaUgVfNSh9z5WVTZ9y.jpg' },
  { title: 'House of the Dragon', type: 'series', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '2', requestType: 'content', description: 'Spin-off de GoT', date: '18/04/2024', time: '11:45', year: '2022', poster: 'https://image.tmdb.org/t/p/w500/2FYvTH3UXyPwxM6RKdI72q12Vfd.jpg' },
  { title: 'Duna', type: 'movie', status: 'rejected', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Filme muito antigo', date: '17/04/2024', time: '20:00', year: '2021', poster: 'https://image.tmdb.org/t/p/w500/2gIZIUnODSVSyEVBqYWGJRJ2ayr.jpg' },
  { title: 'The Last of Us', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Baseado no jogo', date: '17/04/2024', time: '08:00', year: '2023', poster: 'https://image.tmdb.org/t/p/w500/2hYT8Sg85f1adGhVhBjT7724lz0.jpg' },
  { title: 'Interestelar', type: 'movie', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Clássico de sci-fi', date: '16/04/2024', time: '15:30', year: '2014', poster: 'https://image.tmdb.org/t/p/w500/2jADrGSJixn7IwtbffiV3AOkjF9.jpg' },
  { title: 'Stranger Things', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '5', requestType: 'content', description: 'Temporada final', date: '16/04/2024', time: '10:00', year: '2016', poster: 'https://image.tmdb.org/t/p/w500/2JhUaEgz8O9n5IBNUZ5aKXFYgMD.jpg' },
  { title: 'Avatar: O Caminho da Água', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Sequência de Avatar', date: '15/04/2024', time: '18:00', year: '2022', poster: 'https://image.tmdb.org/t/p/w500/2lUypzrIpZ87Crg2yrJKIJ5N5Z9.jpg' },
  { title: 'Better Call Saul', type: 'series', status: 'rejected', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '6', requestType: 'content', description: 'Série completa disponível', date: '15/04/2024', time: '13:00', year: '2015', poster: 'https://image.tmdb.org/t/p/w500/2MRM4PL6H7yraAkwyUEe2EqoQH3.jpg' },
  { title: 'Top Gun: Maverick', type: 'movie', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Ação aérea', date: '14/04/2024', time: '16:45', year: '2022', poster: 'https://image.tmdb.org/t/p/w500/2N7dheuQDyG2c1bWDBRtxMofCO0.jpg' },
  { title: 'Breaking Bad', type: 'series', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Clássico', date: '14/04/2024', time: '09:15', year: '2008', poster: 'https://image.tmdb.org/t/p/w500/2oMk0CFflhAodqPJD1Kua9RKpDD.jpg' },
  { title: 'Oppenheimer', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Pedido repetido', date: '13/04/2024', time: '11:00', year: '2023', poster: 'https://image.tmdb.org/t/p/w500/2OzXrlWz8Qk3AjvBjgSkWDnR8NH.jpg' },
  { title: 'The Office', type: 'series', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Comédia', date: '13/04/2024', time: '14:30', year: '2005', poster: 'https://image.tmdb.org/t/p/w500/2QeSY4fkl3tKRAg3HEiTHxSJg8j.jpg' },
  { title: 'Spider-Man: No Way Home', type: 'movie', status: 'pending', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Marvel multiverso', date: '12/04/2024', time: '17:00', year: '2021', poster: 'https://image.tmdb.org/t/p/w500/2Qxlfs4KnVrpnoqtsAptaNoVxk7.jpg' },
  { title: 'Game of Thrones', type: 'series', status: 'rejected', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', season: '1', requestType: 'content', description: 'Já consta no catálogo', date: '12/04/2024', time: '10:00', year: '2011', poster: 'https://image.tmdb.org/t/p/w500/3Ap6J9pYqgrxQaYWYdX2fyBYBWF.jpg' },
  { title: 'Inception', type: 'movie', status: 'approved', reseller: '<DADO_SEED>', action: 'Adicionar ao catálogo', requestType: 'content', description: 'Christopher Nolan', date: '11/04/2024', time: '20:00', year: '2010', poster: 'https://image.tmdb.org/t/p/w500/3AywI4DpqhZvRyIn9o82p6Og22P.jpg' }
];

// Criar pedidos e dados TMDB
for (const req of requestsData) {
  const resellerId = resellerMap[req.reseller];
  
  const created = RequestModel.create({
    resellerId,
    title: req.title,
    type: req.type,
    status: req.status,
    action: req.action,
    season: req.season,
    episode: req.episode,
    requestType: req.requestType,
    description: req.description,
    date: req.date,
    time: req.time
  });
  
  // Criar dados TMDB
  TmdbModel.create({
    requestId: created.id,
    tmdbId: null,
    title: req.title,
    originalTitle: req.title,
    year: parseInt(req.year) || null,
    posterPath: req.poster,
    backdropPath: null,
    overview: req.description,
    voteAverage: null
  });
  
  console.log(`  🎬 Pedido #${created.id}: ${req.title} (${req.reseller})`);
}

console.log(`\n✅ Seed completo! ${resellersData.length} revendedores, ${requestsData.length} pedidos.`);
