#!/bin/bash
set -euo pipefail

echo "🚀 Iniciando preparação do ambiente para PEDIDOS VOD..."

# ──────────────────────────────────────────────
# 1. DETECTAR VERSÃO DO UBUNTU
# ──────────────────────────────────────────────
UBUNTU_VERSION=$(lsb_release -rs 2>/dev/null || echo "20.04")
echo "📋 Ubuntu detectado: $UBUNTU_VERSION"

# Pacotes compatíveis com a versão do Ubuntu
if echo "$UBUNTU_VERSION" | grep -qE '^24\.'; then
    CUPS_PKG="libcups2t64"
    ATK_PKG="libatk1.0-0t64"
    ATK_BRIDGE_PKG="libatk-bridge2.0-0t64"
    ASOUND_PKG="libasound2t64"
    GTK_PKG="libgtk-3-0t64"
else
    CUPS_PKG="libcups2"
    ATK_PKG="libatk1.0-0"
    ATK_BRIDGE_PKG="libatk-bridge2.0-0"
    ASOUND_PKG="libasound2"
    GTK_PKG="libgtk-3-0"
fi

# ──────────────────────────────────────────────
# 2. FIREWALL — NÃO MEXE NO UFW (XUI usa portas próprias)
# ──────────────────────────────────────────────
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -qi active; then
    echo "🔒 UFW está ativo. Garantindo que as portas do PEDIDOS estão liberadas..."
    sudo ufw allow 8900/tcp comment 'Nginx PEDIDOS'
    sudo ufw status verbose | grep -E '8900|22'
else
    echo "🔒 UFW não está ativo. Pulando configuração de firewall."
    echo "   ⚠️  Se quiser ativar o firewall manualmente, libere as portas:"
    echo "       sudo ufw allow 22/tcp"
    echo "       sudo ufw allow 80/tcp"
    echo "       sudo ufw allow 443/tcp"
    echo "       sudo ufw allow 8880/tcp"
    echo "       sudo ufw allow 31210/tcp"
    echo "       sudo ufw allow 8900/tcp"
    echo "       sudo ufw --force enable"
fi

# ──────────────────────────────────────────────
# 3. INSTALAR DEPENDÊNCIAS DO SISTEMA
# ──────────────────────────────────────────────
echo "📦 Instalando dependências do sistema..."

# Atualizar repositórios
sudo apt-get update || true

# Instalar Node.js (versão 20)
if ! command -v node &>/dev/null; then
    echo "   Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
else
    echo "   Node.js já instalado: $(node -v)"
fi

# Instalar Google Chrome (necessário para o WhatsApp)
if ! command -v google-chrome-stable &>/dev/null; then
    echo "   Instalando Google Chrome..."
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    sudo apt-get update
    sudo apt-get install -y google-chrome-stable
else
    echo "   Google Chrome já instalado."
fi

# Instalar bibliotecas auxiliares
echo "   Instalando bibliotecas do sistema..."
sudo apt-get install -y build-essential python3 \
    ca-certificates \
    libgbm1 \
    libnss3 \
    "$ATK_PKG" \
    "$ATK_BRIDGE_PKG" \
    "$CUPS_PKG" \
    "$GTK_PKG" \
    "$ASOUND_PKG" \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 || echo "   ⚠️  Alguns pacotes podem não estar disponíveis nesta versão do Ubuntu."

# Instalar PM2 globalmente
if ! command -v pm2 &>/dev/null; then
    echo "   Instalando PM2..."
    sudo npm install -g pm2
else
    echo "   PM2 já instalado: $(pm2 -v)"
fi

# ──────────────────────────────────────────────
# 4. INSTALAR DEPENDÊNCIAS DO PROJETO
# ──────────────────────────────────────────────
echo "📁 Instalando dependências do Node.js..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

npm install

# ──────────────────────────────────────────────
# 5. CRIAR .env EXEMPLO (se não existir)
# ──────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "⚠️  Arquivo .env não encontrado."
    echo "📝 Criando arquivo .env de exemplo — EDITE COM SUAS CREDENCIAIS!"
    
    SESSION_SECRET=$(openssl rand -base64 48)
    WHATSAPP_API_TOKEN=$(openssl rand -hex 32)
    
    cat > "$SCRIPT_DIR/.env" << ENVEOF
# Segredo para criptografia dos cookies de sessão
SESSION_SECRET=${SESSION_SECRET}

# Credenciais do Administrador
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
    
    sudo chmod 600 "$SCRIPT_DIR/.env"
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "🔴 ATENÇÃO: Edite o arquivo .env com suas credenciais reais!"
    echo "═══════════════════════════════════════════════"
    echo "📄 Caminho: $SCRIPT_DIR/.env"
    echo ""
fi

if [ -f "$SCRIPT_DIR/.env" ]; then
    sudo chmod 600 "$SCRIPT_DIR/.env"
fi

# ──────────────────────────────────────────────
# 6. CONFIGURAR TERCEIRO NGINX
# ──────────────────────────────────────────────
NGINX_DEST="/root/PEDIDOS/nginx"
echo "🌐 Configurando nginx do PEDIDOS em $NGINX_DEST..."
sudo mkdir -p "$NGINX_DEST"/{sbin,conf,logs,run}

if [ -f "/home/xui/bin/nginx/sbin/nginx" ]; then
    echo "   Copiando binário do nginx existente (XUI)..."
    sudo cp /home/xui/bin/nginx/sbin/nginx "$NGINX_DEST/sbin/"
    echo "✓ Binário copiado"
else
    echo "⚠️  Nginx do XUI não encontrado em /home/xui/bin/nginx/sbin/nginx"
    echo "   Copie manualmente um binário do nginx para $NGINX_DEST/sbin/"
fi

echo "✓ Diretórios criados em $NGINX_DEST"

# ──────────────────────────────────────────────
# 7. CONFIGURAR LOGROTATE PARA PM2
# ──────────────────────────────────────────────
echo "📋 Configurando logrotate para os logs do PM2..."
sudo mkdir -p /etc/logrotate.d
sudo tee /etc/logrotate.d/pedidos-pm2 > /dev/null << 'LOGEOF'
/root/.pm2/pm2.log /root/.pm2/logs/*.log {
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
echo "✅ AMBIENTE CONFIGURADO!"
echo "═══════════════════════════════════════════════"
echo ""
echo "📌 Para rodar o sistema (como root):"
echo "   pm2 start server.js --name 'dashboard'"
echo "   pm2 start whatsapp-server.js --name 'whatsapp-motor'"
echo ""
echo "📌 Para salvar a configuração do PM2:"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "📌 Terceiro nginx (proxy reverso porta 8900):"
echo "   Iniciar:  bash $SCRIPT_DIR/nginx/control.sh start"
echo "   Parar:    bash $SCRIPT_DIR/nginx/control.sh stop"
echo "   Recarreg: bash $SCRIPT_DIR/nginx/control.sh reload"
echo ""
echo "📌 Para ver os logs:"
echo "   pm2 logs"
echo ""
echo "📌 Para gerar hash da senha do admin para o .env:"
echo "   node hash-password.js 'minha_senha_aqui'"
