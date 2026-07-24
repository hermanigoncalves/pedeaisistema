@echo off
title PedeAi - Agente de Impressao
color 0A
echo.
echo  ====================================================
echo   PedeAi - Agente Local de Impressao
echo  ====================================================
echo.

:: Verifica se o Node.js esta instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERRO: Node.js nao encontrado!
    echo  Baixe em: https://nodejs.org
    pause
    exit /b 1
)

:: Verifica se o .env existe
if not exist ".env" (
    echo  AVISO: Arquivo .env nao encontrado!
    echo  Copiando .env.example como .env...
    copy .env.example .env
    echo.
    echo  IMPORTANTE: Edite o arquivo .env com suas configuracoes
    echo  antes de continuar.
    pause
    exit /b 1
)

:: Instala dependencias se necessario
if not exist "node_modules" (
    echo  Instalando dependencias...
    npm install
    echo.
)

echo  Iniciando agente de impressao...
echo  Pressione Ctrl+C para encerrar.
echo.
node index.js

pause
