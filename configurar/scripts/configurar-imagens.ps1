# Configura a geracao de imagens do Gyde (Cloudflare Workers AI, cota diaria gratis).
# Voce vai precisar do Account ID e de um API Token da Cloudflare.
# O token e lido da area de transferencia e nunca aparece na tela.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path '.env'

Write-Host '=== Imagens do Gyde (Cloudflare) ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Dica: para colar nesta janela use Ctrl+V ou clique com o botao direito.'
$typed = Read-Host '1) Cole aqui o seu Account ID e aperte Enter'
# Aceita o ID mesmo se vier com espacos, aspas ou texto junto.
$m = [regex]::Match($typed, '[0-9a-fA-F]{32}')
if (-not $m.Success) {
    Write-Host ''
    Write-Host "Nao achei um Account ID no que voce colou ($($typed.Trim().Length) caracteres)." -ForegroundColor Red
    Write-Host 'O Account ID tem exatamente 32 caracteres, so numeros e letras de a ate f.'
    Write-Host 'Exemplo de formato: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d'
    Write-Host 'Onde achar: painel da Cloudflare > AI > Workers AI > Use REST API,'
    Write-Host 'ou na pagina inicial do painel, menu da sua conta > "Copy account ID".'
    Write-Host 'Cuidado para nao colar o token no lugar do Account ID.'
    Read-Host 'Enter para fechar'; exit 1
}
$account = $m.Value.ToLower()
Write-Host "Account ID ok: $($account.Substring(0,6))..." -ForegroundColor Green

Write-Host ''
# -AsSecureString esconde a digitacao caso a pessoa cole o token aqui por engano.
Read-Host '2) Agora COPIE o API Token (Ctrl+C) e so aperte Enter aqui (nao precisa colar)' -AsSecureString | Out-Null
$token = (Get-Clipboard -Raw)
if ($token) { $token = $token.Trim() }
if (-not $token -or $token.Length -lt 30 -or $token -match '\s') {
    Write-Host 'A area de transferencia nao tem um token valido. Copie o token e rode de novo.' -ForegroundColor Red
    Read-Host 'Enter para fechar'; exit 1
}

Write-Host ''
Write-Host 'Testando com a Cloudflare...'
# Teste real: roda um modelo de texto bem pequeno (gasta quase nada da cota).
$body = Join-Path $env:TEMP 'gyde-cf-teste.json'
[System.IO.File]::WriteAllText($body, '{"prompt":"oi","max_tokens":1}')
$code = & curl.exe -s -o NUL -w '%{http_code}' -m 60 -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data-binary "@$body" "https://api.cloudflare.com/client/v4/accounts/$account/ai/run/@cf/meta/llama-3.2-1b-instruct"
Remove-Item $body -ErrorAction SilentlyContinue
if ($code -ne '200') {
    Write-Host "A Cloudflare recusou (HTTP $code)." -ForegroundColor Red
    if ($code -eq '401' -or $code -eq '403') { Write-Host 'Confira se o token tem a permissao "Workers AI" e se o Account ID e da mesma conta.' }
    Set-Clipboard -Value ' '
    Read-Host 'Enter para fechar'; exit 1
}

$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*CLOUDFLARE_(ACCOUNT_ID|API_TOKEN)\s*=' } }
$lines += "CLOUDFLARE_ACCOUNT_ID=$account"
$lines += "CLOUDFLARE_API_TOKEN=$token"
[System.IO.File]::WriteAllLines($envFile, [string[]]$lines)

Set-Clipboard -Value ' '
Write-Host 'Pronto! Imagens configuradas. Feche e abra o Gyde de novo (iniciar.bat).' -ForegroundColor Green
Read-Host 'Enter para fechar'
