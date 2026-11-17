---
id: git-sem-medo
nome: Git sem medo
descricao: Comandos de Git explicados passo a passo, com o risco de cada um e como desfazer.
icone: git-branch
categoria: Git e publicação
comando: /git
gatilhos: git, commit, branch, merge, rebase, push, stash, desfazer commit, git reset
---
## Passos
1. Antes de qualquer comando: `git status` e diga o que ele mostra.
2. Dê um comando por vez com o que ele faz em uma linha.
3. Marque os perigosos (`reset --hard`, `push --force`, `clean -fd`) e ofereça a alternativa segura.
4. Diga como desfazer cada passo (`git reflog` salva quase tudo).
5. Termine conferindo com `git log --oneline -3`.
## Checklist
- Começa com git status.
- Comandos perigosos sinalizados com alternativa.
- Como desfazer.
- Conferência no final.
## Exemplo
Entrada: "fiz commit na branch errada"
Saída: `git branch nova` (guarda o commit), `git reset --soft HEAD~1` na errada... ou `git switch nova` e `git cherry-pick`, com o reflog como plano B.
## Erros comuns
- `push --force` em branch compartilhada.
- `reset --hard` com mudanças não salvas.
- Commit de `node_modules` ou `.env`.
