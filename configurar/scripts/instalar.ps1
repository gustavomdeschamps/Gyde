# Instalador do Gyde: confere tudo o que precisa e deixa pronto para usar.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root

function Passo($n, $texto) { Write-Host ''; Write-Host "[$n/5] $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "  [ok] $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "  [!] $texto" -ForegroundColor Yellow }
function Sair { Write-Host ''; Read-Host 'Enter para fechar'; exit 1 }

Write-Host '==============================================' -ForegroundColor Blue
Write-Host '   Gyde - seu guia na programacao' -ForegroundColor Blue
Write-Host '   Instalador' -ForegroundColor Blue
Write-Host '==============================================' -ForegroundColor Blue

# 1) Node.js 22.18 ou mais novo (roda TypeScript direto, sem compilar)
Passo 1 'Node.js'
$nodeOk = $false
try {
    $v = (& node -v) -replace '^v', ''
    $p = $v.Split('.') | ForEach-Object { [int]$_ }
    $nodeOk = ($p[0] -gt 22) -or ($p[0] -eq 22 -and $p[1] -ge 18)
    if ($nodeOk) { Ok "Node.js $v" } else { Aviso "Node.js $v e antigo demais (precisa 22.18 ou mais novo)." }
} catch { Aviso 'Node.js nao encontrado.' }
if (-not $nodeOk) {
    $r = Read-Host '  Instalar o Node.js LTS agora pelo winget? (s/n)'
    if ($r -eq 's') {
        winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
        Write-Host ''
        Aviso 'Node.js instalado. FECHE esta janela e abra o instalar.bat de novo.'
    } else {
        Aviso 'Baixe o Node.js LTS em https://nodejs.org e rode o instalar.bat de novo.'
    }
    Sair
}

# 2) Dependencias
Passo 2 'Dependencias do Gyde'
& npm install --no-fund --no-audit --loglevel=error
if ($LASTEXITCODE -ne 0) { Aviso 'O npm install falhou. Confira sua internet e tente de novo.'; Sair }
& npm run build --silent
if ($LASTEXITCODE -ne 0) { Aviso 'Nao consegui gerar a interface do Gyde (npm run build).'; Sair }
Ok 'Dependencias instaladas'

# 3) FreeLLMAPI (o roteador dos modelos gratis)
Passo 3 'FreeLLMAPI'
$routerOk = $false
try { $routerOk = (Invoke-WebRequest 'http://127.0.0.1:31415/health' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}
if ($routerOk) {
    Ok 'FreeLLMAPI esta aberto'
} else {
    Aviso 'O FreeLLMAPI nao esta aberto.'
    Write-Host '  O Gyde usa o FreeLLMAPI para falar com os modelos de IA gratis.'
    Write-Host '  1. Baixe o instalador para Windows (FreeLLMAPI-Setup-...exe) na pagina que vai abrir.'
    Write-Host '  2. Instale, abra, e adicione pelo menos uma chave gratis (ex.: Google AI Studio) na pagina Chaves.'
    $r = Read-Host '  Abrir a pagina de download agora? (s/n)'
    if ($r -eq 's') { Start-Process 'https://github.com/tashfeenahmed/freellmapi/releases/latest' }
    Read-Host '  Quando o FreeLLMAPI estiver aberto, aperte Enter para continuar'
    try { $routerOk = (Invoke-WebRequest 'http://127.0.0.1:31415/health' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}
    if ($routerOk) { Ok 'FreeLLMAPI encontrado' } else { Aviso 'Ainda nao encontrei o FreeLLMAPI. Continue; depois e so abrir ele antes do Gyde.' }
}

# 4) Chave do FreeLLMAPI
Passo 4 'Chave do FreeLLMAPI'
$envFile = Join-Path $root '.env'
$temChave = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^FREELLMAPI_KEY=freellmapi-' -Quiet)
if ($temChave) {
    Ok 'Chave ja configurada'
} else {
    Write-Host '  No icone do FreeLLMAPI (perto do relogio), clique em "Copy Key".'
    Read-Host '  Depois de copiar, aperte Enter aqui' | Out-Null
    $key = (Get-Clipboard -Raw)
    if ($key) { $key = $key.Trim() }
    if ($key -like 'freellmapi-*') {
        $lines = @()
        if (Test-Path $envFile) { $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*FREELLMAPI_(KEY|URL)\s*=' } }
        $lines += "FREELLMAPI_KEY=$key"
        $lines += 'FREELLMAPI_URL=http://127.0.0.1:31415'
        [System.IO.File]::WriteAllLines($envFile, [string[]]$lines)
        Set-Clipboard -Value ' '
        Ok 'Chave salva'
    } else {
        Aviso 'Nao achei a chave na area de transferencia. Depois cole a chave no Gyde, em Configuracoes > IA e modelos.'
    }
}

# 5) Atalho na Area de Trabalho
Passo 5 'Atalho'
try {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'Gyde.lnk'))
    $lnk.TargetPath = Join-Path $root 'iniciar.bat'
    $lnk.WorkingDirectory = $root
    $lnk.IconLocation = Join-Path $root 'pacotes\interface\public\gyde.ico'
    $lnk.Description = 'Gyde - seu guia na programacao'
    $lnk.Save()
    Ok 'Atalho "Gyde" criado na Area de Trabalho'
} catch { Aviso 'Nao consegui criar o atalho. Use o iniciar.bat direto.' }

Write-Host ''
Write-Host 'Tudo pronto!' -ForegroundColor Green
Write-Host 'Extras opcionais: pasta configurar (imagens, voz, VS Code) e pasta pacotes\extensao-chrome (extensao do Chrome).'
$r = Read-Host 'Abrir o Gyde agora? (s/n)'
if ($r -eq 's') { Start-Process (Join-Path $root 'iniciar.bat') -WorkingDirectory $root }
