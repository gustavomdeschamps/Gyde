# Troca a senha de uma conta do Gyde neste computador (modo pessoal).

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Write-Host '=== Trocar senha do Gyde ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Contas neste computador:'
& node (Join-Path $PSScriptRoot 'redefinir-senha.mjs') --listar
if ($LASTEXITCODE -ne 0) { Read-Host 'Enter para fechar'; exit 1 }
Write-Host ''

$email = (Read-Host 'E-mail da conta').Trim()
$s1 = Read-Host 'Senha nova (8+ caracteres, letras e numeros)' -AsSecureString
$s2 = Read-Host 'Repita a senha nova' -AsSecureString
$p1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
$p2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
if ($p1 -ne $p2) {
    Write-Host 'As senhas nao sao iguais.' -ForegroundColor Red
    Read-Host 'Enter para fechar'; exit 1
}

$env:GYDE_EMAIL = $email
$env:GYDE_NOVA_SENHA = $p1
$result = & node (Join-Path $PSScriptRoot 'redefinir-senha.mjs') 2>&1 | Select-Object -Last 1
Remove-Item Env:GYDE_NOVA_SENHA -ErrorAction SilentlyContinue
$p1 = $null; $p2 = $null

if ("$result" -eq 'OK') {
    Write-Host 'Senha trocada! Entre no Gyde com a senha nova.' -ForegroundColor Green
} else {
    Write-Host "$result" -ForegroundColor Red
}
Read-Host 'Enter para fechar'
