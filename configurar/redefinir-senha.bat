@echo off
title Trocar senha do Gyde
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\redefinir-senha.ps1"
