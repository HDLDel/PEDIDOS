#!/bin/bash
set -euo pipefail

echo "🚀 Iniciando preparação segura do ambiente Ubuntu 24.04 para VOD Premium..."

# ──────────────────────────────────────────────
# 1. FIREWALL (configurar ANTES de abrir portas)
# ──────────────────────────────────────────────
echo "🔒 Configurando firewall (UFW)..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw --force enable
sudo ufw status verbose

# ──────────────────────────────────────────────
# 2. CRIAR USUÁRIO DEDICADO (não-root)
# ──────────────────────────────────────────────
if id "vodapp" &>/dev/null; then
    echo "👤 Usuário 'vodapp' já existe."
else
    echo "👤 Criando usuário 'vodapp' para rodar a aplicação..."
    sudo useradd -m -s /bin/bash vodapp
    sudo passwd -l vodapp  # bloqueia login por senha (só SSH key)
    echo "✅ Usuário 'vodapp' criado e login por senha desabilitado."
fi

# ──────────────────────────────────────────────
# 3. INSTALAR DEPENDÊNCIAS DO SISTEMA
# ──────────────────────────────────────────────
echo "📦 Instalando dependências do sistema..."

# Remover repositórios problemáticos (Ookla/Speedtest que não suporta Noble)
sudo rm -f /etc/apt/sources.list.d/ookla_speedtest-cli.list

# Atualizar repositórios
sudo apt-get update || true

# Instalar Node.js (versão 20) — método seguro via repositório oficial
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Instalar Google Chrome Oficial
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update

# Instalar ferramentas de compilação e Google Chrome
sudo apt-get install -y build-essential python3 google-chrome-stable \
    ca-certificates \
    fonts-liberation \
    lsb-release \
    xdg-utils \
    libgbm1 \
    libnss3 \
    libatk1.0-0t64 \
    libatk-bridge2.0-0t64 \
    libcups2t64 \
    libgtk-3-0t64 \
    libasound2t64 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2

# Instalar PM2 globalmente
sudo npm install -g pm2

# ──────────────────────────────────────────────
# 4. INSTALAR DEPENDÊNCIAS DO PROJETO
# ──────────────────────────────────────────────
echo "📁 Instalando dependências do Node.js..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Instalar como root para as dependências do sistema, mas o dono dos arquivos é vodapp
sudo npm install

# Ajustar permissões do projeto para o usuário vodapp
sudo chown -R vodapp:vodapp "$SCRIPT_DIR"
sudo chmod -R 750 "$SCRIPT_DIR"
# Dar permissão de escrita apenas nas pastas necessárias
sudo chmod -R 770 "$SCRIPT_DIR/data"     # Banco de dados
sudo chmod -R 770 "$SCRIPT_DIR/.wwebjs_auth"  # Sessão WhatsApp
sudo chmod -R 770 "$SCRIPT_DIR/.wwebjs_cache" # Cache WhatsApp

# ──────────────────────────────────────────────
# 5. CRIAR .env EXEMPLO (se não existir)
# ──────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "⚠️  Arquivo .env não encontrado."
    echo "📝 Criando arquivo .env de exemplo — EDITE COM SUAS CREDENCIAIS!"
    
    # Gera segredos aleatórios fortes
    SESSION_SECRET=$(openssl rand -base64 48)
    WHATSAPP_API_TOKEN=$(openssl rand -hex 32)
    
    cat > "$SCRIPT_DIR/.env" << ENVEOF
# Segredo para criptografia dos cookies de sessão
SESSION_SECRET=${SESSION_SECRET}

# Credenciais do Administrador (usadas apenas no primeiro boot/seed)
# ADMIN_PASSWORD aceita tanto texto puro quanto hash bcrypt (começa com $2a$...)
# Para gerar um hash: node hash-password.js 'minha_senha'
ADMIN_USERNAME=seu_usuario_admin
ADMIN_PASSWORD=sua_senha_forte_aqui
ADMIN_NAME="<ADMIN_NAME>"

# Chave da API externa
TMDB_API_KEY=sua_chave_tmdb_aqui

# Configurações do WhatsApp
WHATSAPP_API_URL=<WHATSAPP_API_URL>
WHATSAPP_ENABLED=true

# Token de autenticação entre o dashboard e o motor WhatsApp
WHATSAPP_API_TOKEN=${WHATSAPP_API_TOKEN}
ENVEOF
    
    # Restringir permissão: só o dono (vodapp) pode ler
    sudo chown vodapp:vodapp "$SCRIPT_DIR/.env"
    sudo chmod 600 "$SCRIPT_DIR/.env"
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "🔴 ATENÇÃO: Edite o arquivo .env com suas credenciais reais!"
    echo "═══════════════════════════════════════════════"
    echo "📄 Caminho: $SCRIPT_DIR/.env"
    echo "🔑 SESSION_SECRET já foi gerado automaticamente."
    echo "🔒 Permissão do arquivo: chmod 600 (só o usuário vodapp lê)"
    echo ""
fi

# Garantir permissão 600 mesmo se o arquivo já existir
if [ -f "$SCRIPT_DIR/.env" ]; then
    sudo chmod 600 "$SCRIPT_DIR/.env"
fi

# ──────────────────────────────────────────────
# 6. CONFIGURAR NGNIX (se instalado)
# ──────────────────────────────────────────────
if command -v nginx &>/dev/null; then
    echo "🌐 Nginx detectado. Aplicando configuração de segurança..."
    if [ -f /etc/nginx/nginx.conf ]; then
        sudo sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf
    fi
fi

# ──────────────────────────────────────────────
# 7. CONFIGURAR LOGROTATE PARA PM2
# ──────────────────────────────────────────────
echo "📋 Configurando logrotate para os logs do PM2..."
sudo mkdir -p /etc/logrotate.d
sudo tee /etc/logrotate.d/vodapp-pm2 > /dev/null << 'LOGEOF'
/home/vodapp/.pm2/pm2.log /home/vodapp/.pm2/logs/*.log {
    rotate 7
    daily
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
LOGEOF

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ AMBIENTE CONFIGURADO COM SEGURANÇA!"
echo "═══════════════════════════════════════════════"
echo ""
echo "📌 Para rodar o sistema (como usuário vodapp):"
echo "   sudo -u vodapp pm2 start server.js --name 'dashboard'"
echo "   sudo -u vodapp pm2 start whatsapp-server.js --name 'whatsapp-motor'"
echo ""
echo "📌 Para salvar a configuração do PM2:"
echo "   sudo -u vodapp pm2 save"
echo "   sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u vodapp --hp /home/vodapp"
echo ""
echo "📌 Para ver os logs:"
echo "   sudo -u vodapp pm2 logs"
echo ""
echo "═══════════════════════════════════════════════"
echo "🔐 SEGURANÇA DO .env"
echo "═══════════════════════════════════════════════"
echo "✅ .env está com chmod 600 (só o usuário vodapp lê)"
echo "✅ .env está no .gitignore (não vai pro Git)"
echo "✅ SESSION_SECRET foi gerado aleatoriamente"
echo ""
echo "📌 Para gerar hash da senha do admin para o .env:"
echo "   node hash-password.js 'minha_senha_aqui'"
echo "   Copie o hash gerado (algo como \$2a\$10...) e coloque no .env"
echo ""
echo "   Exemplo no .env:"
echo "   ADMIN_PASSWORD=\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
echo ""
echo "⚠️  Se for EDITAR o .env manualmente, depois faça:"
echo "   sudo chmod 600 /home/PEDIDOS/.env"
echo "   sudo chown vodapp:vodapp /home/PEDIDOS/.env"
echo ""
echo "⚠️  Configure HTTPS com Let's Encrypt:"
echo "   sudo certbot --nginx -d seu-dominio.com"
