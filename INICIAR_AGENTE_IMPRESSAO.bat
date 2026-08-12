@echo off
title PedeAi - Agente de Impressao Local
echo ========================================================
echo   Iniciando Agente de Impressao PedeAi (Porta 3001)
echo ========================================================
echo.
cd /d "%~dp0print-agent"
if not exist "node_modules" (
    echo Instalando dependencias do Agente de Impressao...
    npm install
)
echo.
echo Conectando agente de impressao...
node index.js
pause
