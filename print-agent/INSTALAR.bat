@echo off
title PedeAi - Instalador do Agente de Impressao
color 0E
echo.
echo  ====================================================
echo   PedeAi - Instalador do Agente de Impressao Standalone
echo  ====================================================
echo.

:: 1. Verificar existencia do executavel
if not exist "pedeai-printer.exe" (
    echo  ERRO: O arquivo 'pedeai-printer.exe' nao foi encontrado nesta pasta!
    echo  Certifique-se de extrair todos os arquivos juntos antes de rodar o instalador.
    echo.
    pause
    exit /b 1
)

:: 2. Configurar Inicializacao Automatica no Windows (Sem nenhuma instalacao extra)
echo [1/2] Configurando inicializacao automatica com o Windows...
powershell -Command "$s = New-Object -ComObject WScript.Shell; $g = $s.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\PedeAiPrintAgent.lnk\"); $g.TargetPath = \"$PSScriptRoot\iniciar_invisivel.vbs\"; $g.WorkingDirectory = \"$PSScriptRoot\"; $g.Save()"

if %errorlevel% neq 0 (
    echo.
    echo  [AVISO] Nao foi possivel configurar a inicializacao automatica automaticamente.
    echo  Voce pode criar um atalho manual do arquivo 'iniciar_invisivel.vbs' 
    echo  e coloca-lo na pasta inicializar do Windows (Iniciar -> Executar -> shell:startup).
    echo.
    pause
) else (
    echo  Inicializacao automatica configurada com sucesso!
    echo.
)

:: 3. Verificar arquivo .env
echo [2/2] Verificando arquivo de configuracao .env...
if not exist ".env" (
    echo.
    echo  [AVISO] O arquivo de configuracao '.env' nao foi encontrado!
    echo  Criando um modelo baseado no .env.example...
    if exist ".env.example" (
        copy .env.example .env >nul
        echo  Modelo criado! Por favor, configure o IP da impressora no arquivo '.env'
        echo  antes de usar.
    ) else (
        echo  Nao foi possivel encontrar o modelo .env.example.
    )
    echo.
) else (
    echo  Arquivo de configuracao .env pronto!
    echo.
)

:: 4. Conclusao
echo  ====================================================
echo   Instalacao Concluida com Sucesso!
echo  ====================================================
echo.
echo   O Agente de Impressao iniciara automaticamente 
echo   e de forma invisivel (segundo plano) sempre que o 
echo   Windows for iniciado.
echo.
echo   Deseja iniciar o agente de impressao agora? (S/N)
set /p opt=
if /i "%opt%"=="S" (
    start iniciar_invisivel.vbs
    echo.
    echo   Agente iniciado com sucesso em segundo plano!
)
echo.
pause
