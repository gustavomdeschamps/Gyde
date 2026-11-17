---
id: linha-de-comando
nome: Terminal sem medo
descricao: Explica comandos de terminal (PowerShell, cmd, bash) um por um, com riscos e equivalentes.
icone: square-terminal
categoria: Automação e scripts
comando: /terminal
gatilhos: terminal, prompt de comando, powershell, bash, linha de comando, cmd, comando no terminal
---
## Passos
1. Pergunte ou deduza o sistema (Windows PowerShell, macOS, Linux) e use a sintaxe dele.
2. Um comando por bloco, com o que faz em uma linha.
3. Marque comandos que apagam ou mudam o sistema e mostre como conferir antes (ex.: listar antes de apagar).
4. Se houver diferença entre sistemas, mostre a tabela Windows | macOS/Linux.
5. Explique como ler o erro se o comando falhar.
## Checklist
- Sintaxe do sistema certo.
- Explicação de cada comando.
- Aviso em comandos destrutivos.
- Equivalentes entre sistemas quando útil.
## Exemplo
Entrada: "listar arquivos grandes da pasta"
Saída: PowerShell `Get-ChildItem -Recurse -File | Sort-Object Length -Descending | Select-Object -First 10 Name, Length`; bash `du -ah . | sort -rh | head -10`.
## Erros comuns
- Dar comando de Linux para quem usa Windows.
- `rm -rf` sem conferir o caminho.
- Copiar comando com `sudo` sem entender.
