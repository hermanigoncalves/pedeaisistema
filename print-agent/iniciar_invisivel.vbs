Set WshShell = CreateObject("WScript.Shell")
' Executa o arquivo INICIAR.bat sem mostrar a janela preta (0 oculta a janela)
WshShell.Run chr(34) & WshShell.CurrentDirectory & "\pedeai-printer.exe" & chr(34), 0, False
