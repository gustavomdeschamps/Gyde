# Limpa o que ficou obsoleto do Gyde NESTE computador, fora do repositório. Só apaga o que está na LISTA de caminhos
# permitidos abaixo; qualquer outro caminho é recusado (veja limpeza-segura.ps1, que também nunca segue atalhos).
#  - instaladores antigos em <projeto>\dist-desktop (fica só o mais novo)
#  - pastas e arquivos temporários do Gyde em %TEMP% (gyde-*: sobras de testes, capturas e do ver-novidades)
#  - cópias de segurança antigas em Documentos\Gyde-backups (ficam as 5 mais recentes e todas com menos de 7 dias)
# Primeiro mostra a lista; só apaga se você responder S.
# NUNCA apaga: %APPDATA%\Gyde (seus dados, o banco, a pasta data e o .env do app), o .env e a pasta data do projeto.
# Os parâmetros existem para o teste automático (que roda tudo numa pasta temporária); no uso normal, não passe nenhum.
# A cópia oficial deste arquivo está no repositório, em ferramentas\atualizar\.
param(
  [string]$Projeto = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Gyde'),
  [string]$Backups = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Gyde-backups'),
  [string]$Temp = $env:TEMP,
  [string]$AppData = $env:APPDATA,
  [switch]$Confirmar,
  [switch]$SemPausa
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'limpeza-segura.ps1')
function Pausa { if (-not $SemPausa) { Read-Host 'Aperte Enter para fechar' | Out-Null } }

$dist = Join-Path $Projeto 'dist-desktop'
# A LISTA: só isto pode ser apagado
$lista = @(
  @{ Raiz = $dist; Padrao = 'Gyde-Setup-*.exe' },
  @{ Raiz = $dist; Padrao = 'Gyde-Setup-*.exe.blockmap' },
  @{ Raiz = $Temp; Padrao = 'gyde-*' },
  @{ Raiz = $Backups; Padrao = 'Gyde-dados-*' }
)
$protegidos = @((Join-Path $Projeto '.env'), (Join-Path $Projeto 'data'), (Join-Path $Projeto 'pacotes'), (Join-Path $Projeto 'node_modules'))
if ($AppData) { $protegidos += (Join-Path $AppData 'Gyde') }

function Tamanho($item) { if ($item.PSIsContainer -and -not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { (Get-ChildItem $item.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | Measure-Object Length -Sum).Sum } elseif ($item.PSIsContainer) { 0 } else { $item.Length } }

Write-Host ''
Write-Host 'Gyde: limpar o que ficou obsoleto neste computador' -ForegroundColor Cyan
Write-Host ''
if (-not $Confirmar -and (Get-Process -Name 'Gyde', 'electron' -ErrorAction SilentlyContinue)) { Write-Host 'Feche o Gyde (inclusive o das novidades) antes de limpar.' -ForegroundColor Red; Pausa; exit 1 }

$apagar = New-Object System.Collections.Generic.List[object]
# 1) instaladores: fica só o mais novo (e o .blockmap dele)
if (Test-Path $dist) {
  $inst = @(Get-ChildItem $dist -Filter 'Gyde-Setup-*.exe' -File | Sort-Object LastWriteTime -Descending)
  foreach ($i in ($inst | Select-Object -Skip 1)) {
    $apagar.Add([pscustomobject]@{ Onde = 'instalador antigo'; Item = $i })
    $bm = Get-Item ($i.FullName + '.blockmap') -ErrorAction SilentlyContinue
    if ($bm) { $apagar.Add([pscustomobject]@{ Onde = 'instalador antigo'; Item = $bm }) }
  }
}
# 2) temporários do Gyde (todos gyde-*: nenhum é dado seu)
if ($Temp -and (Test-Path $Temp)) {
  # pula cópias de trabalho do git (git worktree): têm um .git dentro e podem ter trabalho ainda não enviado
  foreach ($t in Get-ChildItem $Temp -Filter 'gyde-*' -Force -ErrorAction SilentlyContinue) {
    if ($t.PSIsContainer -and (Test-Path -LiteralPath (Join-Path $t.FullName '.git'))) { Write-Host "  pulado (cópia de trabalho do git): $($t.FullName)"; continue }
    $apagar.Add([pscustomobject]@{ Onde = 'temporário'; Item = $t })
  }
}
# 3) cópias de segurança: ficam as 5 mais recentes e todas com menos de 7 dias
if (Test-Path $Backups) {
  $copias = @(Get-ChildItem $Backups -Directory | Where-Object { $_.Name -like 'Gyde-dados-*' } | Sort-Object LastWriteTime -Descending)
  $limite = (Get-Date).AddDays(-7)
  foreach ($c in ($copias | Select-Object -Skip 5)) { if ($c.LastWriteTime -lt $limite) { $apagar.Add([pscustomobject]@{ Onde = 'cópia de segurança antiga'; Item = $c }) } }
}
# trava: só o que a lista permite (o resto nem aparece)
$seguros = @($apagar | Where-Object { -not (Get-MotivoRecusa $_.Item.FullName $lista $protegidos) })

if (-not $seguros.Count) { Write-Host 'Nada para limpar. Tudo em dia.' -ForegroundColor Green; Write-Host ''; Pausa; exit 0 }
$total = 0
foreach ($s in $seguros) { $tam = Tamanho $s.Item; $total += $tam; Write-Host ('  {0,-26} {1,10:N0} KB  {2}' -f $s.Onde, [math]::Ceiling($tam / 1KB), $s.Item.FullName) }
Write-Host ''
Write-Host ('{0} itens, {1:N1} MB no total.' -f $seguros.Count, ($total / 1MB))
Write-Host 'Nada disso é dado seu: %APPDATA%\Gyde, o .env, o banco e a pasta data ficam.' -ForegroundColor Yellow
Write-Host ''
if (-not $Confirmar) {
  $r = Read-Host 'Apagar estes itens? Responda S para apagar ou Enter para cancelar'
  if ($r -notmatch '^[sS]') { Write-Host 'Cancelado. Nada foi apagado.'; Pausa; exit 0 }
}
$falhas = 0
foreach ($s in $seguros) { try { Remove-Seguro $s.Item.FullName $lista $protegidos } catch { $falhas++; Write-Host "  não deu para apagar $($s.Item.FullName): $($_.Exception.Message)" -ForegroundColor Yellow } }
Write-Host ''
Write-Host ("Pronto: {0} apagados{1}." -f ($seguros.Count - $falhas), $(if ($falhas) { ", $falhas não (em uso?)" } else { '' })) -ForegroundColor Green
Pausa
