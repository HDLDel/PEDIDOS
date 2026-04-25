#!/bin/bash

echo "🚀 Iniciando preparação do ambiente Ubuntu 24.04 para VOD Premium..."

# Remover repositórios problemáticos (Ookla/Speedtest que não suporta Noble)
sudo rm -f /etc/apt/sources.list.d/ookla_speedtest-cli.list

# Atualizar repositórios
sudo apt-get update || true # Ignora erros de repositórios que não existem mais

# Instalar Node.js (versão 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Instalar ferramentas de compilação e Chromium com dependências compatíveis com Ubuntu 24.04
sudo apt-get install -y build-essential python3 \
    chromium-browser \
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

# Instalar PM2 globalmente para gerenciar os processos
sudo npm install -g pm2

echo "✅ Dependências instaladas!"
echo "Para rodar o sistema, use:"
echo "pm2 start server.js --name 'dashboard'"
echo "pm2 start whatsapp-server.js --name 'whatsapp-motor'"
echo ""
echo "Para parar os serviços, use:"
echo "pm2 stop all              # Para tudo"
echo "pm2 stop whatsapp-motor   # Para apenas o WhatsApp"
echo ""
echo "Para ver os logs: pm2 logs"