# Gyde para VS Code

O Gyde dentro do editor: um chat na barra lateral e atalhos para explicar código, revisar
arquivos e entender erros sem copiar e colar nada.

## Instalar

1. Deixe o Gyde rodando (`iniciar.bat`).
2. Dê dois cliques em `instalar-vscode.bat` (pasta `configurar` do Gyde).
3. Abra (ou recarregue) o VS Code. O ícone do Gyde aparece na barra da esquerda.

Sem o comando `code` no PATH: rode `node configurar/scripts/empacotar-vscode.mjs` e, no VS Code,
vá em **Extensões → ⋯ → Instalar do VSIX** e escolha `extensoes/vscode/gyde.vsix`.

## Conectar

1. No Gyde, abra **Personalizar → Extensões → Gerar token** e copie o token.
2. No VS Code, clique no ícone do Gyde → **Colar token**.

O token fica guardado no cofre de senhas do VS Code. Para sair: comando **Gyde: Desconectar**.

## Usar

- **Chat** na barra lateral, com as suas skills (como `/revisar`) funcionando.
- Botão direito no editor:
  - **Explicar com o Gyde** (com um trecho selecionado) — também `Ctrl+Alt+G`.
  - **Revisar com o Gyde**: a seleção ou o arquivo inteiro.
  - **Explicar o erro desta linha**: manda o erro sublinhado e o código em volta.
- Nos blocos de código da resposta: **Inserir no editor** (no cursor) ou **Copiar**.
- As conversas ficam salvas no Gyde: **abrir no Gyde** mostra a mesma conversa no navegador.

Configuração: `gyde.servidor` (padrão `http://127.0.0.1:3210`).
