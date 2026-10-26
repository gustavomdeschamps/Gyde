@echo off
title Instalar o Gyde
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar\scripts\instalar.ps1"
