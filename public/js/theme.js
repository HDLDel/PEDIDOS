(function() {
    try {
        const theme = localStorage.getItem('theme');
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
            document.addEventListener('DOMContentLoaded', () => {
                document.body.classList.add('light-theme');
            });
        }
    } catch (e) {
        console.error('Falha ao acessar o localStorage:', e);
    }
})();
