# Prompt de Ofuscação para Projetos Node.js / Python

Cole este prompt no seu agente de IA para replicar a ofuscação em qualquer projeto.

---

## Prompt para replicar

```
Preciso criar um script de build para ofuscar o código fonte de um projeto [Node.js / Python].

## O que quero

1. Um script (Python ou JS) que gere uma pasta com o NOME_DO_PROJETO/ na raiz
2. Dentro dela, os arquivos .js (ou .py) próprios do projeto DEVEM ficar ofuscados
3. Assets estáticos (views, public, templates, etc.) DEVEM ser copiados intactos
4. Dependências (node_modules, venv, vendor) DEVEM ser copiadas intactas
5. A pasta gerada é a única coisa que vou copiar pro cliente — nada da raiz é usado

## Ferramenta de ofuscação

Use [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator) para JS.

## Regras do script

- Cria a pasta NOME_DO_PROJETO/ (destino) na raiz do projeto
- Limpa a pasta se já existir (rmtree)
- Copia assets estáticos com shutil.copytree (ou fs.cpSync)
- Copia node_modules/ inteira
- Gera .env.example com variáveis placeholder
- Ofusca cada arquivo JS com subprocess.run (ou execSync)
- Usa target: node (importante para Node.js)
- Usa ignore-imports: true (preserva import/require)
- Mensagem final: "Copy the NOME_DO_PROJETO/ folder to the client and run..."

## Arquivos a ofuscar (exemplo)

Geralmente:
- entry point (server.js, app.js, index.js, main.py)
- banco/modelos (db.js, models/*.js, database.py)
- serviços (WhatsAppService, BotBotService, etc.)
- utilitários (seed, hash, helpers)

Mas PULE arquivos que usam módulos com addons nativos (ex: whatsapp-web.js, puppeteer, sharp, bcrypt, better-sqlite3).

## Opções de ofuscação recomendadas

--compact true
--control-flow-flattening true
--control-flow-flattening-threshold 0.75
--dead-code-injection true
--dead-code-injection-threshold 0.4
--identifier-names-generator mangled
--ignore-imports true
--numbers-to-expressions true
--rename-globals false
--self-defending true
--simplify false
--split-strings true
--split-strings-chunk-length 80
--string-array true
--string-array-encoding base64
--string-array-index-shift true
--string-array-rotate true
--string-array-shuffle true
--string-array-threshold 0.8
--string-array-wrappers-chained-calls true
--string-array-wrappers-count 5
--string-array-wrappers-parameters-max-count 4
--target node
--transform-object-keys true
--unicode-escape-sequence false

## Adicionar ao .gitignore

NOME_DO_PROJETO/

## Adicionar ao package.json

"scripts": {
  "obfuscate": "python3 build-obfuscated.py"
}

---

Gere os arquivos build-obfuscated.py e/ou build-obfuscated.js para este projeto.
```
