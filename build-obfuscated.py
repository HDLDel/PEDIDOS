#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'PEDIDOS')
OBFUSCATOR = 'javascript-obfuscator'

JS_FILES = [
    'server.js', 'db.js', 'WhatsAppService.js', 'BotBotService.js',
    'seed.js', 'hash-password.js', 'add_admin.js', 'test_render.js',
]

MODEL_FILES = [
    'AdminModel.js', 'M3uModel.js', 'RequestModel.js',
    'ResellerModel.js', 'TmdbModel.js',
]

OPTS = [
    '--compact', 'true',
    '--control-flow-flattening', 'true',
    '--control-flow-flattening-threshold', '0.75',
    '--dead-code-injection', 'true',
    '--dead-code-injection-threshold', '0.4',
    '--identifier-names-generator', 'mangled',
    '--ignore-imports', 'true',
    '--numbers-to-expressions', 'true',
    '--rename-globals', 'false',
    '--self-defending', 'true',
    '--simplify', 'false',
    '--split-strings', 'true',
    '--split-strings-chunk-length', '80',
    '--string-array', 'true',
    '--string-array-encoding', 'base64',
    '--string-array-index-shift', 'true',
    '--string-array-rotate', 'true',
    '--string-array-shuffle', 'true',
    '--string-array-threshold', '0.8',
    '--string-array-wrappers-chained-calls', 'true',
    '--string-array-wrappers-count', '5',
    '--string-array-wrappers-parameters-max-count', '4',
    '--target', 'node',
    '--transform-object-keys', 'true',
    '--unicode-escape-sequence', 'false',
]


def main():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)

    for d in ['views/admin', 'views/revenda', 'public/css', 'models', 'data']:
        os.makedirs(os.path.join(DIST, d), exist_ok=True)

    for item in ['views', 'public', 'package.json', 'package-lock.json']:
        src = os.path.join(ROOT, item)
        dst = os.path.join(DIST, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)

    minify_opts = [
        '--collapse-whitespace',
        '--remove-comments',
        '--minify-css', 'true',
        '--minify-js', 'true',
        '--ignore-custom-fragments', '<%[\\s\\S]*?%>',
    ]
    for root, _dirs, files in os.walk(os.path.join(DIST, 'views')):
        for f in files:
            if f.endswith(('.html', '.ejs')):
                p = os.path.join(root, f)
                print(f'Minifying: {os.path.relpath(p, DIST)}')
                subprocess.run(['npx', 'html-minifier', p, '-o', p] + minify_opts, check=True)

    shutil.copytree(
        os.path.join(ROOT, 'node_modules'),
        os.path.join(DIST, 'node_modules'),
        dirs_exist_ok=True,
    )

    with open(os.path.join(DIST, '.env.example'), 'w') as f:
        f.write(
            'SESSION_SECRET=seu_segredo_aqui\n'
            'ADMIN_USERNAME=admin\n'
            'ADMIN_PASSWORD=sua_senha\n'
            'ADMIN_NAME=Administrador\n'
            'TMDB_API_KEY=sua_key_tmdb\n'
            'WHATSAPP_API_TOKEN=token_whatsapp\n'
            'BOTBOT_TOKEN=token_botbot\n'
            'PORT=8901\n'
            'WA_PORT=8902\n'
        )

    for f in JS_FILES:
        src = os.path.join(ROOT, f)
        dst = os.path.join(DIST, f)
        print(f'Obfuscating: {f}')
        subprocess.run([OBFUSCATOR, src, '--output', dst] + OPTS, check=True)

    for m in MODEL_FILES:
        src = os.path.join(ROOT, 'models', m)
        dst = os.path.join(DIST, 'models', m)
        print(f'Obfuscating: models/{m}')
        subprocess.run([OBFUSCATOR, src, '--output', dst] + OPTS, check=True)

    print('\nDone! Obfuscated files in PEDIDOS/')
    print('Copy the PEDIDOS/ folder to the client and run: cd PEDIDOS && npm start')


if __name__ == '__main__':
    main()
