@echo off
title Configurar e-mail do Gyde
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar-email.ps1"
