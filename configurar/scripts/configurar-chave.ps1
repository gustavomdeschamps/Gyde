# Salva a chave unificada do FreeLLMAPI no arquivo .env do Gyde.
# Antes de rodar: clique no icone do FreeLLMAPI na bandeja e em "Copy Key".
# A chave e lida da area de transferencia e nunca aparece na tela.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path '.env'

$key = (Get-Clipboard -Raw)
if ($key) { $key = $key.Trim() }
if (-not $key -or $key -notlike 'freellmapi-*') {
    Write-Host 'A area de transferencia nao tem a chave unificada (freellmapi-...).' -ForegroundColor Red
    Write-Host 'Clique em "Copy Key" no icone do FreeLLMAPI na bandeja e rode de novo.'
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*FREELLMAPI_KEY\s*=' } }
$lines += "FREELLMAPI_KEY=$key"
if (-not ($lines -match '^\s*FREELLMAPI_URL\s*=')) { $lines += 'FREELLMAPI_URL=http://127.0.0.1:31415' }
[System.IO.File]::WriteAllLines($envFile, [string[]]$lines)   # UTF-8 sem BOM

Set-Clipboard -Value ' '   # limpa a chave da area de transferencia
Write-Host 'Chave salva em .env. Agora abra o Gyde com o iniciar.bat (pasta principal).' -ForegroundColor Green
Read-Host 'Pressione Enter para fechar'
