#!/bin/bash

echo "🚀 Iniciando preparação do ambiente Ubuntu para VOD Premium..."

# Atualizar repositórios
sudo apt-get update

# Instalar Node.js (versão 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar dependências do Puppeteer (Essencial para o WhatsApp)
sudo apt-get install -y libgbm-dev wget unzip fontconfig locatere gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils libatk-bridge2.0-0

# Instalar PM2 globalmente para gerenciar os processos
sudo npm install -g pm2

echo "✅ Dependências instaladas!"
echo "Para rodar o sistema, use:"
echo "pm2 start server.js --name 'dashboard'"
echo "pm2 start whatsapp-server.js --name 'whatsapp-motor'"
echo ""
echo "Para ver os logs: pm2 logs"