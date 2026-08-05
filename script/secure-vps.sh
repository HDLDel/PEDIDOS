#!/bin/bash
set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  🔐  SEGURANÇA - Troca de Credenciais"
echo "  PEDIDOS VOD"
echo "═══════════════════════════════════════════════"
echo ""

# ────────────────────────────────────────────
# AUTO-LOCALIZAÇÃO DA RAIZ DO PROJETO
# ────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$(basename "$SCRIPT_DIR")" = "script" ] && [ -f "$SCRIPT_DIR/../server.js" ]; then
    SCRIPT_DIR="$(dirname "$SCRIPT_DIR")"
fi
cd "$SCRIPT_DIR"

# ────────────────────────────────────────────
# VERIFICAÇÕES
# ────────────────────────────────────────────
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado no diretório atual."
    echo "   Execute este script DENTRO da pasta do projeto (ex: /root/PEDIDOS)"
    exit 1
fi

if [ ! -f server.js ]; then
    echo "❌ Script não está na raiz do projeto (server.js não encontrado)."
    exit 1
fi

echo "📁 Projeto encontrado: $(pwd)"
echo ""

# ────────────────────────────────────────────
# 1. GERAR NOVO SESSION_SECRET
# ────────────────────────────────────────────
echo "🔑 [1/5] Gerando novo SESSION_SECRET..."
NOVO_SECRET=$(openssl rand -base64 48)
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${NOVO_SECRET}|" .env
echo "   ✅ SESSION_SECRET atualizado."

# ────────────────────────────────────────────
# 2. GERAR NOVA SENHA DE ADMIN
# ────────────────────────────────────────────
echo "🔑 [2/5] Gerando nova senha do administrador..."
NOVA_SENHA=$(openssl rand -base64 12 | tr -d '=' | tr '/+' '_-')

# Buscar o admin username do .env
ADMIN_USER=$(grep "^ADMIN_USERNAME=" .env | cut -d'=' -f2)
if [ -z "$ADMIN_USER" ]; then
    ADMIN_USER="<ADMIN_USERNAME>"
    echo "   ⚠️  ADMIN_USERNAME não encontrado no .env. Usando: $ADMIN_USER"
fi

sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${NOVA_SENHA}|" .env
echo "   ✅ ADMIN_PASSWORD atualizado no .env."

# ────────────────────────────────────────────
# 3. ATUALIZAR HASH DA SENHA NO BANCO
# ────────────────────────────────────────────
echo "🗄️  [3/5] Atualizando senha no banco de dados SQLite..."

# Descobrir qual banco está sendo usado (data/vod.sqlite ou vod.sqlite)
DB_PATH=""
for path in "data/vod.sqlite" "vod.sqlite"; do
    if [ -f "$path" ]; then
        DB_PATH="$path"
        break
    fi
done

if [ -z "$DB_PATH" ]; then
    echo "   ⚠️  Banco SQLite não encontrado. Pulando atualização no banco."
    echo "   Você precisará resetar a senha manualmente pelo painel."
else
    echo "   Banco encontrado: $DB_PATH"
    node -e "
    const Database = require('better-sqlite3');
    const bcrypt = require('bcryptjs');
    const db = new Database('${DB_PATH}');
    const hash = bcrypt.hashSync('${NOVA_SENHA}', 10);
    const info = db.prepare('UPDATE admins SET password = ? WHERE username = ?').run(hash, '${ADMIN_USER}');
    if (info.changes > 0) {
        console.log('   ✅ Senha do admin \\'${ADMIN_USER}\\' atualizada no banco.');
    } else {
        console.log('   ⚠️  Admin \\'${ADMIN_USER}\\' não encontrado no banco. Pule esta etapa.');
    }
    db.close();
    "
fi

# ────────────────────────────────────────────
# 4. REMOVER WHATSAPP_TOKEN PLACEHOLDER
# ────────────────────────────────────────────
echo "🧹 [4/6] Removendo WHATSAPP_TOKEN placeholder (não usado)..."
if grep -q "^WHATSAPP_TOKEN=seu_token_aqui" .env; then
    sed -i "/^WHATSAPP_TOKEN=seu_token_aqui/d" .env
    echo "   ✅ WHATSAPP_TOKEN placeholder removido."
else
    echo "   ℹ️  Nenhum placeholder encontrado para remover."
fi

# ────────────────────────────────────────────
# 5. ROTACIONAR WHATSAPP_API_TOKEN
# ────────────────────────────────────────────
echo "🔑 [5/6] Gerando novo WHATSAPP_API_TOKEN..."
NOVO_WA_TOKEN=$(openssl rand -hex 32)
if grep -q "^WHATSAPP_API_TOKEN=" .env; then
    sed -i "s|^WHATSAPP_API_TOKEN=.*|WHATSAPP_API_TOKEN=${NOVO_WA_TOKEN}|" .env
else
    echo "" >> .env
    echo "# Token de autenticação entre o dashboard e o motor WhatsApp" >> .env
    echo "WHATSAPP_API_TOKEN=${NOVO_WA_TOKEN}" >> .env
fi
echo "   ✅ WHATSAPP_API_TOKEN atualizado."

# ────────────────────────────────────────────
# 6. REINICIAR OS SERVIÇOS
# ────────────────────────────────────────────
echo "🔄 [6/6] Reiniciando os serviços..."
if command -v pm2 &>/dev/null; then
    pm2 restart dashboard 2>/dev/null || pm2 restart server.js --name dashboard 2>/dev/null || echo "   ⚠️  PM2 não está rodando dashboard. Reinicie manualmente."
    pm2 restart whatsapp-motor 2>/dev/null || pm2 restart whatsapp-server.js --name whatsapp-motor 2>/dev/null || echo "   ⚠️  PM2 não está rodando whatsapp-motor. Reinicie manualmente."
    echo "   ✅ Dashboard e WhatsApp reiniciados."
else
    echo "   ⚠️  PM2 não encontrado. Reinicie os servidores manualmente."
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅  CREDENCIAIS ROTACIONADAS COM SUCESSO!"
echo "═══════════════════════════════════════════════"
echo ""
echo "  📌 NOVO SESSION_SECRET:       ${NOVO_SECRET}"
echo "  📌 NOVA SENHA DO ADMIN:       ${NOVA_SENHA}"
echo "  📌 NOVO WHATSAPP_API_TOKEN:   ${NOVO_WA_TOKEN}"
echo ""
echo "  ⚠️  GUARDE ESTAS INFORMAÇÕES EM LOCAL SEGURO!"
echo "  ⚠️  Faça login no painel com a nova senha (se Cloudflare proxy ativo, use o domínio):"
echo "       https://SEU_DOMINIO/admin/login"
echo "       Ou diretamente: http://IP:8901/admin/login"
echo ""
echo "═══════════════════════════════════════════════"
