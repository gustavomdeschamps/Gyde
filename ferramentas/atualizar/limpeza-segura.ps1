# Funções de limpeza segura, usadas por limpar-antigos.ps1 e preparar-atualizacao.ps1.
# Só apagam o que está numa LISTA EXPLÍCITA de caminhos permitidos (raiz + padrão de nome do item de primeiro nível)
# e nunca seguem atalhos (junction ou link simbólico): o atalho é removido, o destino dele fica intacto.
# Em 16/11/2026 uma remoção recursiva seguiu uma junction e apagou arquivos do projeto; isto evita que se repita.

function Get-CaminhoCheio([string]$p) { return [IO.Path]::GetFullPath($p).TrimEnd('\', '/') }
function Test-Dentro([string]$filho, [string]$pai) {
  $f = Get-CaminhoCheio $filho; $r = (Get-CaminhoCheio $pai) + [IO.Path]::DirectorySeparatorChar
  return $f.StartsWith($r, [StringComparison]::OrdinalIgnoreCase)
}

# Devolve o motivo de recusa, ou $null se o caminho pode ser apagado.
function Get-MotivoRecusa([string]$Caminho, $Lista, $Protegidos) {
  if (-not $Caminho) { return 'caminho vazio' }
  $c = Get-CaminhoCheio $Caminho
  foreach ($x in $Protegidos) {
    if (-not $x) { continue }
    $y = Get-CaminhoCheio $x
    if ($c -ieq $y -or (Test-Dentro $c $y) -or (Test-Dentro $y $c)) { return "protegido ($y)" }
  }
  if ($c -match '[\\/]\.env($|\.)' -or $c -match '\.(db|sqlite)$') { return 'protegido (.env ou banco)' }
  foreach ($r in $Lista) {
    $raiz = Get-CaminhoCheio $r.Raiz
    if (-not (Test-Dentro $c $raiz)) { continue }
    $primeiro = $c.Substring($raiz.Length + 1).Split([char[]]@('\', '/'))[0]
    if ($primeiro -like $r.Padrao) { return $null }
  }
  return 'fora da lista de caminhos permitidos'
}

function Remove-SemSeguirAtalhos([string]$p) {
  $item = Get-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue
  if (-not $item) { return }
  $atalho = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  if ($item.PSIsContainer) {
    if (-not $atalho) {
      foreach ($filho in @(Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue)) { Remove-SemSeguirAtalhos $filho.FullName }
    }
    [IO.Directory]::Delete($p, $false) # sem recursão: num atalho, apaga só o atalho
  } else {
    if (-not $atalho) { $item.Attributes = [IO.FileAttributes]::Normal }
    [IO.File]::Delete($p)
  }
}

# Apaga um caminho da lista; qualquer outro é recusado com erro, sem apagar nada.
function Remove-Seguro([string]$Caminho, $Lista, $Protegidos) {
  $motivo = Get-MotivoRecusa $Caminho $Lista $Protegidos
  if ($motivo) { throw "Limpeza recusada: ${Caminho}: $motivo" }
  Remove-SemSeguirAtalhos (Get-CaminhoCheio $Caminho)
}
