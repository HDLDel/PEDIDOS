import http from 'http';

http.get('http://localhost:3000', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // Verificar estrutura do primeiro card
        const cardStart = data.indexOf('<article class="card"');
        const cardEnd = data.indexOf('</article>', cardStart) + 10;
        const firstCard = data.substring(cardStart, cardEnd);
        console.log('=== Primeiro Card ===');
        console.log(firstCard);
        console.log('');
        
        // Verificar se há tags div não fechadas
        const openDivs = (data.match(/<div/g) || []).length;
        const closeDivs = (data.match(/<\/div>/g) || []).length;
        console.log(`<div abertas: ${openDivs}`);
        console.log(`</div> fechadas: ${closeDivs}`);
        console.log(`Diferença: ${openDivs - closeDivs}`);
        
        // Verificar estrutura do header
        const headerStart = data.indexOf('<header');
        const headerEnd = data.indexOf('</header>') + 9;
        console.log('\n=== Header ===');
        console.log(data.substring(headerStart, headerEnd));
        
        // Verificar estrutura do modal
        const modalStart = data.indexOf('<div class="modal-overlay" id="rejectModal"');
        const modalEnd = data.indexOf('</div>', data.indexOf('</div>', data.indexOf('</div>', modalStart + 1)) + 1) + 6;
        console.log('\n=== Modal Rejeitar (início) ===');
        console.log(data.substring(modalStart, modalStart + 800));
        
        // Salvar HTML completo
        import('fs').then(fs => {
            fs.writeFileSync('test_output.html', data);
            console.log('\nHTML completo salvo em test_output.html');
        });
    });
}).on('error', (e) => {
    console.error('Erro:', e.message);
});
