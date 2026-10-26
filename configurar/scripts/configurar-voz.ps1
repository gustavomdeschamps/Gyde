# Salva a chave do Google AI Studio (Gemini) no arquivo .env do Gyde, para gerar voz natural.
# Antes de rodar: copie a sua chave em https://aistudio.google.com/apikey (botao de copiar).
# A chave e lida da area de transferencia e nunca aparece na tela.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path '.env'

$key = (Get-Clipboard -Raw)
if ($key) { $key = ($key -replace '\s', '').Trim('"', "'") }
if (-not $key -or $key -notmatch '^[A-Za-z0-9_\-\.]{30,}$') {
    $tam = if ($key) { $key.Length } else { 0 }
    Write-Host "A area de transferencia nao parece ter uma chave (encontrei $tam caracteres)." -ForegroundColor Red
    Write-Host 'Copie a chave em https://aistudio.google.com/apikey (icone de copiar ao lado da chave) e rode de novo.'
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

Write-Host 'Testando a chave...'
try {
    $null = Invoke-RestMethod -Uri 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' -Headers @{ 'x-goog-api-key' = $key } -TimeoutSec 20
} catch {
    Write-Host 'O Google recusou essa chave. Confira se copiou a chave inteira.' -ForegroundColor Red
    Read-Host 'Pressione Enter para fechar'
    exit 1
}

$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*GEMINI_API_KEY\s*=' } }
$lines += "GEMINI_API_KEY=$key"
[System.IO.File]::WriteAllLines($envFile, [string[]]$lines)   # UTF-8 sem BOM

Set-Clipboard -Value ' '   # limpa a chave da area de transferencia
Write-Host 'Chave do Gemini salva em .env. Pode avisar que esta pronto.' -ForegroundColor Green
Read-Host 'Pressione Enter para fechar'
