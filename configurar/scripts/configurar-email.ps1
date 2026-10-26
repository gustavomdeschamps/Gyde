# Configura o envio dos codigos de confirmacao do Gyde pelo seu Gmail.
# Voce precisa de uma "senha de app" do Google (nao e a sua senha normal).
# A senha de app e lida da area de transferencia e nunca aparece na tela.

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envFile = Join-Path $root '.env'

Write-Host '=== E-mail do Gyde (Gmail) ===' -ForegroundColor Cyan
Write-Host ''
$email = (Read-Host '1) Digite o seu Gmail (ex.: voce@gmail.com)').Trim()
if ($email -notmatch '^[^\s@]+@(gmail|googlemail)\.com$') {
    Write-Host 'Use um endereco do Gmail (termina com @gmail.com).' -ForegroundColor Red
    Read-Host 'Enter para fechar'; exit 1
}

Write-Host ''
Write-Host '2) Crie a senha de app em: https://myaccount.google.com/apppasswords'
Write-Host '   (de o nome "Gyde", clique em Criar e COPIE a senha de 16 letras)'
Read-Host '   Depois de copiar, aperte Enter aqui (nao precisa colar)' -AsSecureString | Out-Null
$pass = (Get-Clipboard -Raw)
if ($pass) { $pass = ($pass -replace '\s', '') }
if (-not $pass -or $pass -notmatch '^[a-zA-Z]{16}$') {
    Write-Host 'A area de transferencia nao tem uma senha de app (16 letras). Copie de novo e rode outra vez.' -ForegroundColor Red
    Read-Host 'Enter para fechar'; exit 1
}

Write-Host ''
Write-Host "Mandando um e-mail de teste para $email ..."
$env:SMTP_HOST = 'smtp.gmail.com'
$env:SMTP_PORT = '465'
$env:SMTP_USER = $email
$env:SMTP_PASS = $pass
$result = & node (Join-Path $PSScriptRoot 'testar-email.mjs') 2>&1 | Select-Object -Last 1
Remove-Item Env:SMTP_PASS -ErrorAction SilentlyContinue

if ("$result" -ne 'OK') {
    Set-Clipboard -Value ' '
    if ("$result" -eq 'ERRO_LOGIN') {
        Write-Host 'O Google recusou o login.' -ForegroundColor Red
        Write-Host 'Confira: (1) o Gmail digitado e o mesmo da senha de app; (2) a verificacao em duas etapas esta ativada na sua conta Google.'
    } else {
        Write-Host "Nao deu para enviar: $result" -ForegroundColor Red
    }
    Read-Host 'Enter para fechar'; exit 1
}

$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*(SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_PASS|MAIL_FROM)\s*=' } }
$lines += 'SMTP_HOST=smtp.gmail.com'
$lines += 'SMTP_PORT=465'
$lines += "SMTP_USER=$email"
$lines += "SMTP_PASS=$pass"
$lines += "MAIL_FROM=Gyde <$email>"
[System.IO.File]::WriteAllLines($envFile, [string[]]$lines)

Set-Clipboard -Value ' '
Write-Host ''
Write-Host "Pronto! Chegou um e-mail de teste em $email." -ForegroundColor Green
Write-Host 'Feche e abra o Gyde de novo (iniciar.bat) para valer.'
Read-Host 'Enter para fechar'
