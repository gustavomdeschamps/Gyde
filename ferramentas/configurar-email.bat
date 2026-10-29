@echo off
title Configurar e-mail do Gyde
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-email.ps1"
