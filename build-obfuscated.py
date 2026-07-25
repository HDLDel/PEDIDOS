#!/usr/bin/env python3
"""
Build script: gera pasta PEDIDOS/ com codigo ofuscado para deploy.

- .js → javascript-obfuscator (target node, ignore-imports)
- .ejs → html-minifier (preserva fragmentos EJS)
- Assets (views/, public/) → copiados intactos
- Infra (nginx/, setup-ubuntu.sh, etc.) → copiados intactos
- WhatsApp (whatsapp-server.js, whatsapp-worker.js) → copiados intactos (addon nativo)
- Gera .env.example
- Remove arquivos .md
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.resolve()
DEST = PROJECT_DIR / "PEDIDOS"

# JS a ofuscar (raiz)
JS_FILES = [
    "server.js", "db.js", "WhatsAppService.js", "BotBotService.js",
    "seed.js", "hash-password.js", "add_admin.js", "test_render.js",
]

# Models a ofuscar
MODEL_FILES = [
    "AdminModel.js", "M3uModel.js", "RequestModel.js",
    "ResellerModel.js", "TmdbModel.js",
]

# WhatsApp - copiar intacto (addon nativo)
WHATSAPP_FILES = ["whatsapp-server.js", "whatsapp-worker.js"]

# Assets estaticos
STATIC_DIRS = ["views", "public"]

# Arquivos de infraestrutura (copiados intactos)
INFRA_FILES = [
    "setup-ubuntu.sh", "secure-vps.sh",
    "package.json", "package-lock.json",
]
# Arquivos nginx copiados para deploy
NGINX_FILES = ["control.sh", "pedidos-nginx.service", "terceiro-nginx.conf", "mime.types"]
NGINX_DIRS = ["conf"]

# Opcoes do javascript-obfuscator
OBFUSCATOR_OPTS = [
    "--compact", "true",
    "--control-flow-flattening", "true",
    "--control-flow-flattening-threshold", "0.75",
    "--dead-code-injection", "true",
    "--dead-code-injection-threshold", "0.4",
    "--identifier-names-generator", "mangled",
    "--ignore-imports", "true",
    "--numbers-to-expressions", "true",
    "--rename-globals", "false",
    "--self-defending", "true",
    "--simplify", "false",
    "--split-strings", "true",
    "--split-strings-chunk-length", "80",
    "--string-array", "true",
    "--string-array-encoding", "base64",
    "--string-array-index-shift", "true",
    "--string-array-rotate", "true",
    "--string-array-shuffle", "true",
    "--string-array-threshold", "0.8",
    "--string-array-wrappers-chained-calls", "true",
    "--string-array-wrappers-count", "5",
    "--string-array-wrappers-parameters-max-count", "4",
    "--target", "node",
    "--transform-object-keys", "true",
    "--unicode-escape-sequence", "false",
]


def log(msg):
    print(f"  {msg}")


def copy_static():
    for d in STATIC_DIRS:
        src = PROJECT_DIR / d
        if src.exists():
            dst = DEST / d
            shutil.copytree(src, dst, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            log(f"✓ copiado: {d}/")


def copy_infrastructure():
    # Arquivos raiz
    for f in INFRA_FILES:
        src = PROJECT_DIR / f
        if src.exists():
            shutil.copy2(src, DEST / f)
            log(f"✓ copiado: {f}")

    # Nginx - copiar apenas arquivos essenciais (nao os de sistema)
    nginx_dst = DEST / "nginx"
    nginx_dst.mkdir(parents=True, exist_ok=True)
    for d in NGINX_DIRS:
        src = PROJECT_DIR / "nginx" / d
        if src.exists():
            shutil.copytree(src, nginx_dst / d, dirs_exist_ok=True)
            log(f"✓ copiado: nginx/{d}/")
    for f in NGINX_FILES:
        src = PROJECT_DIR / "nginx" / f
        if src.exists():
            shutil.copy2(src, nginx_dst / f)
            log(f"✓ copiado: nginx/{f}")

    # data/ - pasta vazia para o sqlite em runtime
    (DEST / "data").mkdir(parents=True, exist_ok=True)
    log("✓ criado: data/ (vazio)")


def copy_whatsapp_intact():
    for f in WHATSAPP_FILES:
        src = PROJECT_DIR / f
        if src.exists():
            shutil.copy2(src, DEST / f)
            log(f"✓ copiado (addon nativo): {f}")


def minify_css():
    """Minifica .css com csso-cli."""
    css_files = list(DEST.rglob("*.css"))
    if not css_files:
        log("Nenhum arquivo .css para minificar")
        return

    log(f"{len(css_files)} arquivo(s) .css encontrado(s)")

    # Garantir que csso-cli esta disponivel
    try:
        subprocess.run(
            ["./node_modules/.bin/csso", "--version"],
            check=True, capture_output=True, text=True, cwd=PROJECT_DIR,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        log("Instalando csso...")
        subprocess.run(
            ["npm", "install", "--save-dev", "csso-cli"],
            check=True, capture_output=True, text=True, cwd=PROJECT_DIR,
        )

    count = 0
    total_before = 0
    total_after = 0
    for css_path in css_files:
        size_before = css_path.stat().st_size
        total_before += size_before
        rel = css_path.relative_to(DEST)
        try:
            result = subprocess.run(
                ["./node_modules/.bin/csso", str(css_path), "--output", str(css_path)],
                capture_output=True, text=True, timeout=30, cwd=PROJECT_DIR,
            )
            if result.returncode == 0:
                size_after = css_path.stat().st_size
                total_after += size_after
                count += 1
                pct = round((1 - size_after / size_before) * 100) if size_before > 0 else 0
                log(f"✓ minificado: {rel} (-{pct}%)")
            else:
                total_after += size_before
                log(f"⚠ aviso: {rel} - {result.stderr[:80]}")
        except Exception as e:
            total_after += size_before
            log(f"⚠ erro: {rel} - {e}")

    pct = round((1 - total_after / total_before) * 100) if total_before > 0 else 0
    log(f"✓ {count}/{len(css_files)} arquivo(s) CSS minificados (-{pct}% total)")


def minify_ejs():
    """Minifica .ejs/.html com html-minifier, preservando fragmentos EJS."""
    views_dir = DEST / "views"
    if not views_dir.exists():
        return

    ejs_files = list(views_dir.rglob("*.ejs")) + list(views_dir.rglob("*.html"))
    if not ejs_files:
        log("Nenhum arquivo .ejs/.html para minificar")
        return

    log(f"{len(ejs_files)} arquivo(s) .ejs/.html encontrado(s)")

    opts = [
        "--collapse-whitespace",
        "--remove-comments",
        "--minify-css", "true",
        "--minify-js", "false",
        "--ignore-custom-fragments", "<%[\\s\\S]*?%>",
    ]

    count = 0
    for p in ejs_files:
        rel = p.relative_to(DEST)
        if p.stat().st_size == 0:
            log(f"~ ignorado (vazio): {rel}")
            continue
        try:
            subprocess.run(
                ["./node_modules/.bin/html-minifier", str(p), "-o", str(p)] + opts,
                check=True, capture_output=True, text=True, timeout=30,
            )
            count += 1
            log(f"✓ minificado: {rel}")
        except subprocess.CalledProcessError as e:
            log(f"⚠ erro: {rel} - {e.stderr[:80]}")

    log(f"✓ {count}/{len(ejs_files)} arquivo(s) minificados")


def obfuscate_js():
    log(f"{len(JS_FILES)} arquivo(s) JS raiz + {len(MODEL_FILES)} model(s)")

    # Verificar se o obfuscator esta disponivel
    try:
        subprocess.run(
            ["./node_modules/.bin/javascript-obfuscator", "--version"],
            check=True, capture_output=True, text=True, cwd=PROJECT_DIR,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        log("Instalando javascript-obfuscator...")
        subprocess.run(
            ["npm", "install", "--save-dev", "javascript-obfuscator"],
            check=True, capture_output=True, text=True, cwd=PROJECT_DIR,
        )

    # Ofuscar JS da raiz (Backend Node.js)
    for f in JS_FILES:
        src = PROJECT_DIR / f
        dst = DEST / f
        cmd = ["./node_modules/.bin/javascript-obfuscator", str(src),
               "--output", str(dst)] + OBFUSCATOR_OPTS
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True,
                           cwd=PROJECT_DIR, timeout=120)
            log(f"✓ ofuscado (backend): {f}")
        except subprocess.CalledProcessError as e:
            log(f"⚠ erro: {f} - {e.stderr[:80]}")
            shutil.copy2(src, dst)

    # Ofuscar models (Backend Node.js)
    for m in MODEL_FILES:
        src = PROJECT_DIR / "models" / m
        dst = DEST / "models" / m
        dst.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["./node_modules/.bin/javascript-obfuscator", str(src),
               "--output", str(dst)] + OBFUSCATOR_OPTS
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True,
                           cwd=PROJECT_DIR, timeout=120)
            log(f"✓ ofuscado (backend): models/{m}")
        except subprocess.CalledProcessError as e:
            log(f"⚠ erro: models/{m} - {e.stderr[:80]}")
            shutil.copy2(src, dst)

    # Ofuscar JS do Browser (Front-End)
    BROWSER_JS_FILES = [
        "theme.js", "dashboard.js", "admin-botbot.js", "admin-resellers.js",
        "admin-whatsapp.js", "revenda-buscar-filme.js", "revenda-solicitar.js",
        "revenda-dashboard.js"
    ]
    
    # Criar opções específicas de browser a partir de OBFUSCATOR_OPTS
    browser_opts = OBFUSCATOR_OPTS.copy()
    try:
        target_idx = browser_opts.index("--target")
        browser_opts[target_idx + 1] = "browser"
    except ValueError:
        browser_opts += ["--target", "browser"]

    for f in BROWSER_JS_FILES:
        src = PROJECT_DIR / "public" / "js" / f
        dst = DEST / "public" / "js" / f
        dst.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["./node_modules/.bin/javascript-obfuscator", str(src),
               "--output", str(dst)] + browser_opts
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True,
                           cwd=PROJECT_DIR, timeout=120)
            log(f"✓ ofuscado (browser): public/js/{f}")
        except subprocess.CalledProcessError as e:
            log(f"⚠ erro: public/js/{f} - {e.stderr[:80]}")
            shutil.copy2(src, dst)


def gen_env_example():
    content = (
        "SESSION_SECRET=seu_segredo_aqui\n"
        "ADMIN_USERNAME=admin\n"
        "ADMIN_PASSWORD=sua_senha\n"
        "ADMIN_NAME=Administrador\n"
        "TMDB_API_KEY=sua_key_tmdb\n"
        "WHATSAPP_API_TOKEN=token_whatsapp\n"
    )
    (DEST / ".env.example").write_text(content)
    log("✓ .env.example gerado")


def cleanup_unnecessary_files():
    count = 0
    for p in list(DEST.rglob("*")):
        if p.is_file() and p.suffix.lower() == ".md":
            try:
                p.unlink()
                count += 1
            except Exception:
                pass
    log(f"✓ {count} arquivo(s) .md removidos")


def main():
    if DEST.exists():
        log(f"Removendo PEDIDOS/ existente...")
        shutil.rmtree(DEST)

    DEST.mkdir(parents=True)
    log("Criado PEDIDOS/\n")

    log("1. Copiando assets estaticos...")
    copy_static()
    print()

    log("2. Minificando CSS...")
    minify_css()
    print()

    log("3. Copiando infraestrutura...")
    copy_infrastructure()
    print()

    log("4. Copiando WhatsApp (intacto)...")
    copy_whatsapp_intact()
    print()

    log("5. Minificando EJS/HTML...")
    minify_ejs()
    print()

    log("6. Ofuscando JavaScript...")
    obfuscate_js()
    print()

    log("7. Gerando .env.example...")
    gen_env_example()
    print()

    log("8. Removendo arquivos desnecessarios...")
    cleanup_unnecessary_files()
    print()

    print("=" * 50)
    print(" Build concluido!")
    print(f" Pasta: PEDIDOS/")
    print()
    print(" Deploy:")
    print("   scp -r PEDIDOS/ root@SEU_IP:/root/")
    print("   ssh root@SEU_IP")
    print("   cd /root/PEDIDOS && bash setup-ubuntu.sh")
    print("=" * 50)


if __name__ == "__main__":
    main()
