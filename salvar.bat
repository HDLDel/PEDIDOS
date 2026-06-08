@echo off
REM Muda para o diretorio do script
cd /d "%~dp0"

cls
echo ======================================================
echo           VOD PREMIUM - SISTEMA DE BACKUP (GIT)
echo ======================================================
echo.

:: Verifica se o Git foi inicializado, se não, inicializa
if not exist .git (
    echo [!] Inicializando o controle de versao pela primeira vez...
    git init
)

:: 1. Pergunta qual a mensagem do commit
set /p mensagem="O que voce alterou? (Descreva para poder voltar depois se quebrar): "

:: Se o usuario der enter sem digitar nada, define uma mensagem padrao
if "%mensagem%"=="" set mensagem="Atualizacao de rotina"

echo.
echo [+] Limpando arquivos temporarios...
if exist npm-debug.log del /q npm-debug.log

echo [+] Adicionando arquivos ao ponto de restauracao...
git add .

echo [+] Criando a versao: "%mensagem%"
git commit -m "%mensagem%"
echo.
echo ======================================================
echo           SUCESSO! PROJETO VERSIONADO
echo ======================================================
echo.
echo Ultimos 5 registros no historico:
git log --oneline -n 5
echo.
pause
