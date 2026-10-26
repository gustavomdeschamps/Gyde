@echo off
title Configurar chave do Gyde
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar-chave.ps1"
