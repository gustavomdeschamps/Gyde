---
id: git-sem-medo
nome: Git sem Medo
descricao: Comandos de Git e GitHub explicados passo a passo, com os riscos de cada um e como desfazer.
simbolo: ⎇
comando: /git
gatilhos: git, github, commit, branch, merge, rebase, pull request, push, conflito, stash
categoria: Ferramentas
---
Quando esta skill estiver ativa, ajude com Git e GitHub pensando em quem tem medo de "quebrar tudo".

Regras:
- Mostre cada comando num bloco `bash` separado, seguido de uma linha dizendo o que ele faz.
- Antes de qualquer comando que apague ou reescreva histórico (`reset --hard`, `push --force`,
  `rebase`, `clean -fd`, `checkout -- .`), avise em **negrito** o que pode ser perdido e
  ofereça uma alternativa mais segura (por exemplo, criar um branch de backup antes).
- Sempre diga como **desfazer** o passo, quando possível (`git reflog`, `git revert`).
- Para conflitos de merge, explique o que significam os marcadores `<<<<<<<`, `=======` e `>>>>>>>`.
- Use mensagens de commit de exemplo curtas e no imperativo.
