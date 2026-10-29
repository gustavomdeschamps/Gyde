# Funções para fotografar janelas reais e clicar em botões pela automação de interface do Windows (UI Automation).
# Clicar pelo nome do botão não depende do foco: nenhuma tecla vai parar em outra janela aberta.
Add-Type -AssemblyName System.Drawing, UIAutomationClient, UIAutomationTypes
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class Janela {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
}
'@
[Janela]::SetProcessDPIAware() | Out-Null

function Salvar-Janela([IntPtr]$h, [string]$arquivo) {
  $r = New-Object Janela+RECT
  [Janela]::GetWindowRect($h, [ref]$r) | Out-Null
  $w = $r.Right - $r.Left; $a = $r.Bottom - $r.Top
  $bmp = New-Object System.Drawing.Bitmap $w, $a
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $dc = $g.GetHdc(); [Janela]::PrintWindow($h, $dc, 2) | Out-Null; $g.ReleaseHdc($dc)
  # recorta a sombra invisível do Windows 11 (a moldura real vem do DWM)
  $d = New-Object Janela+RECT
  if ([Janela]::DwmGetWindowAttribute($h, 9, [ref]$d, 16) -eq 0) {
    $x = $d.Left - $r.Left; $y = $d.Top - $r.Top; $cw = $d.Right - $d.Left; $ca = $d.Bottom - $d.Top
    if ($cw -gt 0 -and $ca -gt 0 -and ($cw -lt $w -or $ca -lt $a)) { $bmp = $bmp.Clone((New-Object System.Drawing.Rectangle $x, $y, $cw, $ca), $bmp.PixelFormat) }
  }
  $bmp.Save($arquivo, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
}

function Janela-Do-Processo([int]$processo, [int]$segundos = 30) {
  $raiz = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::ProcessIdProperty), $processo
  for ($i = 0; $i -lt $segundos * 4; $i++) {
    $j = $raiz.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
    if ($j) { return $j }
    Start-Sleep -Milliseconds 250
  }
  return $null
}

function Botoes($janela) {
  $cond = New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::ControlTypeProperty), ([System.Windows.Automation.ControlType]::Button)
  return $janela.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
}

function Clicar($janela, [string]$padrao) {
  foreach ($b in (Botoes $janela)) {
    if ($b.Current.Name -match $padrao -and $b.Current.IsEnabled) {
      $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); return $true
    }
  }
  return $false
}
