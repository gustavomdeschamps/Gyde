@echo off
title Gyde
cd /d "%~dp0"
rem instala as dependencias na primeira vez e de novo sempre que o package-lock.json mudar (ex.: depois de atualizar)
fc /b package-lock.json node_modules\.gyde-lock >nul 2>nul || (
  echo Instalando ou atualizando as dependencias...
  call npm install --no-audit --no-fund || (echo Falha no npm install. & pause & exit /b 1)
  copy /y package-lock.json node_modules\.gyde-lock >nul
)
rem gera a interface (pacotes/interface/dist); leva poucos segundos
call npm run build --silent || (echo Falha ao gerar a interface. & pause & exit /b 1)
rem porta: 3210, ou a linha PORT=... do arquivo .env
set "GYDE_PORT=3210"
if exist .env for /f "tokens=2 delims==" %%p in ('findstr /b /c:"PORT=" .env') do set "GYDE_PORT=%%p"
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:%GYDE_PORT%"
echo Deixe esta janela aberta enquanto usa o Gyde. Para fechar, feche esta janela.
node pacotes\servidor\server.ts
pause
