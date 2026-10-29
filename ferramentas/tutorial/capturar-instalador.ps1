# Capturas reais do instalador do Gyde para o tutorial: roda o instalador com a tela normal, fotografa cada página,
# avança clicando nos botões (UI Automation), deixa o Gyde abrir pela tela final e fotografa a janela do app.
# No fim desinstala e apaga só os dados que esta captura criou (se %APPDATA%\Gyde já existia, não mexe).
# Uso: powershell -File ferramentas\tutorial\capturar-instalador.ps1 [-Instalador caminho.exe]
param([string]$Instalador = (Join-Path $PSScriptRoot '..\..\dist-desktop\Gyde-Setup-2.0.0.exe'))
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'janelas.ps1')
$saida = Join-Path $PSScriptRoot '..\..\docs\tutorial\capturas'
New-Item -ItemType Directory -Force $saida | Out-Null
$programa = Join-Path $env:LOCALAPPDATA 'Programs\Gyde'
$dados = Join-Path $env:APPDATA 'Gyde'
if (Test-Path $programa) { throw "O Gyde já está instalado em $programa. Desinstale antes de capturar." }
$dadosExistiam = Test-Path $dados
$foto = { param($j, $nome) Salvar-Janela ([IntPtr]$j.Current.NativeWindowHandle) (Join-Path $saida $nome); "foto: $nome" }

$p = Start-Process $Instalador -PassThru
try {
  $j = Janela-Do-Processo $p.Id 40
  if (-not $j) { throw 'o instalador não abriu' }
  Start-Sleep -Milliseconds 1200
  & $foto $j 'instalador-1-para-quem.png'
  if (-not (Clicar $j '^Próximo')) { throw 'sem botão Próximo' }
  Start-Sleep -Milliseconds 1500
  & $foto $j 'instalador-2-pasta.png'
  if (-not (Clicar $j '^Instalar')) { throw 'sem botão Instalar' }
  # progresso: fotografa enquanto copia
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 300
    $nomes = (Botoes $j | ForEach-Object { $_.Current.Name }) -join '|'
    if ($i -eq 2) { & $foto $j 'instalador-3-instalando.png' }
    if ($nomes -match 'Concluir') { break }
  }
  for ($i = 0; $i -lt 240 -and -not ((Botoes $j | ForEach-Object { $_.Current.Name }) -join '|' -match 'Concluir'); $i++) { Start-Sleep -Milliseconds 500 }
  Start-Sleep -Milliseconds 800
  & $foto $j 'instalador-4-concluido.png'
  if (-not (Clicar $j '^Concluir')) { throw 'sem botão Concluir' }
} finally { Start-Sleep 1; if (-not $p.HasExited) { Stop-Process $p -Force -ErrorAction SilentlyContinue } }

# o instalador abre o Gyde: fotografa a tela de abertura e a janela pronta
$app = $null
for ($i = 0; $i -lt 60 -and -not $app; $i++) { $app = Get-Process Gyde -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1; Start-Sleep -Milliseconds 250 }
if ($app) {
  $h = [IntPtr]$app.MainWindowHandle
  Salvar-Janela $h (Join-Path $saida 'app-1-abrindo.png'); 'foto: app-1-abrindo.png'
  Start-Sleep 9
  Salvar-Janela $h (Join-Path $saida 'app-2-primeira-tela.png'); 'foto: app-2-primeira-tela.png'
} else { 'o Gyde não abriu depois de Concluir' }

# limpeza: fecha, desinstala em silêncio e apaga os dados criados por esta captura
Get-Process Gyde -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2
$des = Get-ChildItem $programa -Filter 'Uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($des) { Start-Process $des.FullName -ArgumentList '/S' -Wait; for ($i = 0; $i -lt 40 -and (Test-Path (Join-Path $programa 'Gyde.exe')); $i++) { Start-Sleep -Milliseconds 500 } }
if (-not $dadosExistiam -and (Test-Path $dados)) { Remove-Item $dados -Recurse -Force }
"instalado ainda? " + (Test-Path (Join-Path $programa 'Gyde.exe')) + " | dados ainda? " + (Test-Path $dados)
