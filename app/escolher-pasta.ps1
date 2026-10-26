# Abre a janela "Selecionar pasta" do Explorador de Arquivos e devolve o caminho escolhido (vazio se cancelar).
# Usado pela Forja, o agente de código do Gyde. Roda só no computador de quem usa o Gyde.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SeletorPasta {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialog {}
  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint c, IntPtr f); void SetFileTypeIndex(uint i); void GetFileTypeIndex(out uint i);
    void Advise(IntPtr e, out uint c); void Unadvise(uint c);
    void SetOptions(uint o); void GetOptions(out uint o);
    void SetDefaultFolder(IShellItem i); void SetFolder(IShellItem i); void GetFolder(out IShellItem i); void GetCurrentSelection(out IShellItem i);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n); void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t); void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t); void GetResult(out IShellItem i);
  }
  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr a, ref Guid b, ref Guid c, out IntPtr d); void GetParent(out IShellItem i);
    void GetDisplayName(uint s, [MarshalAs(UnmanagedType.LPWStr)] out string n);
  }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  public static string Escolher(string titulo) {
    var d = (IFileDialog)new FileOpenDialog();
    d.SetOptions(0x20 | 0x40 | 0x800); // pastas, só do sistema de arquivos, caminho precisa existir
    d.SetTitle(titulo); d.SetOkButtonLabel("Abrir no Gyde");
    if (d.Show(GetForegroundWindow()) != 0) return "";
    IShellItem item; d.GetResult(out item); string caminho; item.GetDisplayName(0x80058000, out caminho);
    return caminho;
  }
}
"@
[SeletorPasta]::Escolher("Escolha a pasta do projeto para a Forja")
