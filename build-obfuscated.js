import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'html-minifier';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = __dirname;
const DIST = path.join(ROOT, 'PEDIDOS');
const OBFUSCATOR = 'npx javascript-obfuscator';

const JS_FILES = [
  'server.js',
  'db.js',
  'WhatsAppService.js',
  'BotBotService.js',
  'seed.js',
  'hash-password.js',
  'add_admin.js',
  'test_render.js',
];

const MODEL_FILES = [
  'AdminModel.js',
  'M3uModel.js',
  'RequestModel.js',
  'ResellerModel.js',
  'TmdbModel.js',
];

// Clean dist
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}

// Create dirs
fs.mkdirSync(path.join(DIST, 'views/admin'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'views/revenda'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'public/css'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'models'));
fs.mkdirSync(path.join(DIST, 'data'));

// Copy static assets
fs.cpSync(path.join(ROOT, 'views'), path.join(DIST, 'views'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), path.join(DIST, 'public'), { recursive: true });
fs.cpSync(path.join(ROOT, 'nginx'), path.join(DIST, 'nginx'), { recursive: true });
fs.cpSync(path.join(ROOT, 'package.json'), path.join(DIST, 'package.json'));
fs.cpSync(path.join(ROOT, 'package-lock.json'), path.join(DIST, 'package-lock.json'));
fs.cpSync(path.join(ROOT, 'node_modules'), path.join(DIST, 'node_modules'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'script'), { recursive: true });
fs.cpSync(path.join(ROOT, 'script/setup-ubuntu.sh'), path.join(DIST, 'script/setup-ubuntu.sh'));
fs.cpSync(path.join(ROOT, 'script/secure-vps.sh'), path.join(DIST, 'script/secure-vps.sh'));
fs.cpSync(path.join(ROOT, 'script/control.sh'), path.join(DIST, 'script/control.sh'));

// Copy WhatsApp files intact (not obfuscated)
for (const f of ['whatsapp-server.js', 'whatsapp-worker.js']) {
  fs.cpSync(path.join(ROOT, f), path.join(DIST, f));
}

// Minify HTML/EJS
const htmlMinifierOpts = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
  ignoreCustomFragments: [/<%[\s\S]*?%>/],
};
function walkAndMinify(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndMinify(full);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.ejs')) {
      console.log(`Minifying: ${path.relative(DIST, full)}`);
      const content = fs.readFileSync(full, 'utf-8');
      fs.writeFileSync(full, minify(content, htmlMinifierOpts));
    }
  }
}
walkAndMinify(path.join(DIST, 'views'));

// Create .env.example
fs.writeFileSync(path.join(DIST, '.env.example'), `SESSION_SECRET=seu_segredo_aqui
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sua_senha
ADMIN_NAME=Administrador
TMDB_API_KEY=sua_key_tmdb
WHATSAPP_API_TOKEN=token_whatsapp
`);

// Obfuscate root JS files
const obfuscateOpts = [
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
];

for (const file of JS_FILES) {
  const src = path.join(ROOT, file);
  const dst = path.join(DIST, file);
  console.log(`Obfuscating: ${file}`);
  execSync(`${OBFUSCATOR} ${src} --output ${dst} ${obfuscateOpts.join(' ')}`, { stdio: 'inherit' });
}

// Obfuscate model files
const modelOpts = [
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
];

for (const file of MODEL_FILES) {
  const src = path.join(ROOT, 'models', file);
  const dst = path.join(DIST, 'models', file);
  console.log(`Obfuscating: models/${file}`);
  execSync(`${OBFUSCATOR} ${src} --output ${dst} ${modelOpts.join(' ')}`, { stdio: 'inherit' });
}

console.log('\nDone! Obfuscated files in PEDIDOS/');
console.log('Copy the PEDIDOS/ folder to the client and run: cd PEDIDOS && npm start');
