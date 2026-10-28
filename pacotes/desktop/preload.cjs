// Ponte mínima entre a interface e o app de desktop. Só o que a interface precisa, nada de Node exposto.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gydeDesktop', {
  escolherPasta: () => ipcRenderer.invoke('gyde:escolher-pasta'),
  redefinirSenha: (email, senha) => ipcRenderer.invoke('gyde:redefinir-senha', email, senha),
});
