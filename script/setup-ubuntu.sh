#!/bin/bash
set +e
# ↑ set +e: falhas não críticas não matam o script

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
# 2. FIREWALL — abrir portas do PEDIDOS sem mexer nos outros serviços
# ──────────────────────────────────────────────
echo "🔓 Liberando portas 8900 e 8901 no firewall..."

# iptables (sempre presente no Linux)
sudo iptables -C INPUT -p tcp --dport 8900 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT -p tcp --dport 8900 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 8901 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT -p tcp --dport 8901 -j ACCEPT

# UFW (se existir e estiver ativo)
if command -v ufw &>/dev/null; then
    sudo ufw allow 8900/tcp comment 'Nginx PEDIDOS' 2>/dev/null || true
    sudo ufw allow 8901/tcp comment 'Dashboard PEDIDOS' 2>/dev/null || true
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

# Compilador e ferramentas para native addons (better-sqlite3)
echo "   Instalando compilador e ferramentas..."
sudo apt-get install -y make gcc g++ python3 pkg-config

# Bibliotecas para o Chrome/Puppeteer
echo "   Instalando bibliotecas do sistema..."
sudo apt-get install -y \
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
# Se estiver em script/, sobe um nível para a raiz do projeto
if [ "$(basename "$SCRIPT_DIR")" = "script" ] && [ -f "$SCRIPT_DIR/../server.js" ]; then
    SCRIPT_DIR="$(dirname "$SCRIPT_DIR")"
fi
cd "$SCRIPT_DIR"

npm install

# ──────────────────────────────────────────────
# 5. CRIAR .env EXEMPLO (se não existir)
# ──────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "⚠️  Arquivo .env não encontrado."
    echo "📝 Criando arquivo .env de exemplo — EDITE COM SUAS CREDENCIAIS!"
    
    SESSION_SECRET=$(openssl rand -base64 48)
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '=' | tr '/+' '_-')
    WHATSAPP_API_TOKEN=$(openssl rand -hex 32)
    
    cat > "$SCRIPT_DIR/.env" << ENVEOF
SESSION_SECRET=${SESSION_SECRET}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_NAME=Administrador
TMDB_API_KEY=sua_key_tmdb
WHATSAPP_API_TOKEN=${WHATSAPP_API_TOKEN}
PALANTIR_ENABLED=false
ENVEOF
    
    sudo chmod 600 "$SCRIPT_DIR/.env"
    echo "   ✅ Senha do admin gerada: ${ADMIN_PASSWORD}"
    echo "   ✅ WHATSAPP_API_TOKEN gerado"
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "🔴 ATENÇÃO: Edite o .env se quiser mudar as credenciais!"
    echo "   TMDB_API_KEY precisa ser preenchida manualmente."
    echo "═══════════════════════════════════════════════"
    echo "📄 Caminho: $SCRIPT_DIR/.env"
    echo ""
fi

if [ -f "$SCRIPT_DIR/.env" ]; then
    sudo chmod 600 "$SCRIPT_DIR/.env"
fi

# ──────────────────────────────────────────────
# 5b. EXECUTAR SEED (dados de exemplo: revendedores, pedidos)
# ──────────────────────────────────────────────
echo "🌱 Executando seed do banco de dados..."
cd "$SCRIPT_DIR"
node seed.js 2>&1 || echo "   ⚠️  Seed falhou (banco pode já existir)"

# ──────────────────────────────────────────────
# 6. CONFIGURAR TERCEIRO NGINX (instância 100% isolada)
# ──────────────────────────────────────────────
NGINX_DEST="$SCRIPT_DIR/nginx"
echo "🌐 Configurando nginx do PEDIDOS em $NGINX_DEST..."
sudo mkdir -p "$NGINX_DEST"/{sbin,conf,logs,run}

# Descobrir binário do nginx — pode ser de outro nginx na máquina (XUI/sistema)
NGINX_BIN=""
for p in /usr/sbin/nginx /usr/local/nginx/sbin/nginx /opt/nginx/sbin/nginx; do
    [ -x "$p" ] && { NGINX_BIN="$p"; break; }
done

if [ -z "$NGINX_BIN" ]; then
    echo "   Nginx não encontrado. Instalando via apt..."
    sudo apt-get install -y nginx
    NGINX_BIN="/usr/sbin/nginx"
fi

echo "   Copiando binário do nginx para instância isolada..."
sudo cp "$NGINX_BIN" "$NGINX_DEST/sbin/nginx"
echo "✓ Binário copiado de $NGINX_BIN ($($NGINX_BIN -v 2>&1))"

# Matar instância antiga do PEDIDOS se estiver rodando (não mexe nos outros nginx)
if [ -f "$NGINX_DEST/run/nginx.pid" ]; then
    OLD_PID=$(cat "$NGINX_DEST/run/nginx.pid")
    kill "$OLD_PID" 2>/dev/null && echo "   Instância antiga do PEDIDOS nginx finalizada (PID $OLD_PID)" || true
    rm -f "$NGINX_DEST/run/nginx.pid"
fi

# Copiar config do terceiro nginx (conf/nginx.conf vem do terceiro-nginx.conf)
echo "   Copiando arquivos de configuração..."
sudo cp "$SCRIPT_DIR/nginx/terceiro-nginx.conf" "$NGINX_DEST/conf/nginx.conf" || true
if [ ! -f "$NGINX_DEST/conf/mime.types" ]; then
    for m in /etc/nginx/mime.types /usr/local/nginx/conf/mime.types /home/xui/bin/nginx/conf/mime.types; do
        if [ -f "$m" ]; then
            sudo cp "$m" "$NGINX_DEST/conf/mime.types"
            break
        fi
    done
fi
sudo chmod +x "$SCRIPT_DIR/script/control.sh" 2>/dev/null || true
echo "✓ Configuração copiada para $NGINX_DEST/"

# Instalar systemd service para o nginx do PEDIDOS (sobrevive a reboot)
echo "   Instalando systemd service para nginx do PEDIDOS..."
sudo cp "$SCRIPT_DIR/nginx/pedidos-nginx.service" /etc/systemd/system/pedidos-nginx.service || true
sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl enable pedidos-nginx.service 2>/dev/null || true
echo "✓ Systemd service pedidos-nginx.service instalado e habilitado"

# ──────────────────────────────────────────────
# 7. CONFIGURAR LOGROTATE PARA PM2
# ──────────────────────────────────────────────
echo "📋 Configurando logrotate para os logs do PM2..."
sudo mkdir -p /etc/logrotate.d
sudo tee /etc/logrotate.d/pedidos-pm2 > /dev/null << 'LOGEOF' || true
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

# ──────────────────────────────────────────────
# 8. INICIAR SERVIÇOS
# ──────────────────────────────────────────────
echo "🚀 Iniciando serviços via PM2..."
cd "$SCRIPT_DIR"
pm2 delete pedidos 2>/dev/null || true
pm2 delete whatsapp-motor 2>/dev/null || true
pm2 start server.js --name pedidos
pm2 start whatsapp-server.js --name whatsapp-motor

# Aguardar dashboard subir
echo "   ⏳ Aguardando dashboard ficar pronto..."
for i in $(seq 1 10); do
    if curl -sf http://127.0.0.1:8901 > /dev/null 2>&1; then
        echo "   ✅ Dashboard respondendo na porta 8901"
        break
    fi
    [ "$i" -eq 10 ] && echo "   ⚠️  Dashboard não respondeu. Verifique: pm2 logs pedidos"
    sleep 1
done

pm2 save || true
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo "   ✅ PM2 salvo. Serviços serão restaurados após reboot."

# Testar configuração do nginx antes de iniciar
echo "🌐 Testando configuração do nginx..."
if "$NGINX_DEST/sbin/nginx" -c "$NGINX_DEST/conf/nginx.conf" -p "$NGINX_DEST" -t 2>&1; then
    echo "   ✅ Configuração do nginx válida"
    sudo systemctl restart pedidos-nginx.service 2>/dev/null || bash "$SCRIPT_DIR/script/control.sh" start 2>&1

    # Aguardar nginx subir
    for i in $(seq 1 10); do
        if curl -sf http://127.0.0.1:8900 > /dev/null 2>&1; then
            echo "   ✅ Nginx respondendo na porta 8900"
            NGINX_OK=true
            break
        fi
        [ "$i" -eq 10 ] && echo "   ⚠️  Nginx não respondeu. Verifique: bash $SCRIPT_DIR/script/control.sh status"
        sleep 1
    done
else
    echo "   ❌ Configuração do nginx INVÁLIDA"
    echo "      Verifique o arquivo: $NGINX_DEST/conf/nginx.conf"
    echo "      Após corrigir: bash $SCRIPT_DIR/script/control.sh start"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ AMBIENTE CONFIGURADO E SERVIÇOS INICIADOS!"
echo "═══════════════════════════════════════════════"
echo ""
IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "SEU_IP")
echo "🔑 ADMIN PASSWORD: ${ADMIN_PASSWORD:-$(grep ^ADMIN_PASSWORD= .env | cut -d= -f2)}"
echo ""
echo "📌 Acessar o sistema:"
echo "   http://${IP}:8900"
echo "   http://${IP}:8901 (acesso direto, sem proxy)"
echo ""
echo "📌 Status dos serviços:"
echo "   pm2 status"
echo ""
echo "📌 Nginx proxy (porta 8900):"
echo "   Iniciar:  bash $SCRIPT_DIR/script/control.sh start"
echo "   Parar:    bash $SCRIPT_DIR/script/control.sh stop"
echo "   Recarreg: bash $SCRIPT_DIR/script/control.sh reload"
echo ""
echo "📌 Para ver os logs:"
echo "   pm2 logs"
echo ""
echo "📌 Para gerar hash da senha do admin para o .env:"
echo "   node hash-password.js 'minha_senha_aqui'"
