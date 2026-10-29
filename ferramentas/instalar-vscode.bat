@echo off
title Instalar o Gyde no VS Code
cd /d "%~dp0.."
echo Gerando o pacote da extensao...
node pacotes\extensao-vscode\empacotar.mjs || goto erro
where code >nul 2>nul || goto semcode
call code --install-extension "pacotes\extensao-vscode\gyde.vsix" --force || goto erro
del "pacotes\extensao-vscode\gyde.vsix" >nul 2>nul
echo.
echo Pronto! Abra (ou recarregue) o VS Code: o Gyde aparece na barra lateral esquerda.
echo Primeiro uso: clique no icone do Gyde e em "Colar token" (gere o token no Gyde em Configuracoes > Extensoes).
pause
exit /b 0
:semcode
echo Nao achei o comando "code". Instale o VS Code ou, no VS Code, use Extensoes ^> ... ^> Instalar do VSIX
echo e escolha o arquivo pacotes\extensao-vscode\gyde.vsix.
pause
exit /b 1
:erro
echo Algo deu errado. Veja a mensagem acima.
pause
exit /b 1
