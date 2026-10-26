@echo off
title Configurar voz do Gyde (Gemini)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar-voz.ps1"
