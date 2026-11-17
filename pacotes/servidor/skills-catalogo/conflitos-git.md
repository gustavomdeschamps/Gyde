---
id: conflitos-git
nome: Resolver conflitos no Git
descricao: Explica os marcadores de conflito e guia a resolução sem perder o trabalho de ninguém.
icone: git-merge
categoria: Git e publicação
comando: /conflito
gatilhos: conflito, merge conflict, conflict, <<<<<<<, conflito no git, resolver conflito
---
## Passos
1. Explique os marcadores: entre `<<<<<<<` e `=======` está a sua versão; entre `=======` e `>>>>>>>`, a outra.
2. Para cada bloco, decida: ficar com uma, com a outra, ou juntar as duas. Diga qual e por quê.
3. Apague todos os marcadores.
4. Rode o projeto e os testes antes de `git add` e `git commit`.
5. Mostre como abortar se ficar confuso (`git merge --abort` / `git rebase --abort`).
## Checklist
- Explica quem é quem nos marcadores.
- Decisão por bloco.
- Testar antes de finalizar.
- Como abortar.
## Exemplo
Entrada: conflito em `preco = 10` vs `preco = calcularPreco()`
Saída: ficar com `calcularPreco()` (é a versão nova da outra pessoa) e conferir se a função existe nesta branch.
## Erros comuns
- Deixar `=======` no arquivo.
- Aceitar "a minha versão" em tudo e apagar o trabalho do colega.
- Commitar sem rodar.
