---
id: commits-claros
nome: Commits e mensagens claras
descricao: Divide mudanças em commits pequenos e escreve mensagens que explicam o porquê.
icone: git-commit-horizontal
categoria: Git e publicação
comando: /commit
gatilhos: mensagem de commit, commit message, commits, conventional commits, histórico do git
---
## Passos
1. Separe por assunto: um commit por mudança lógica (`git add -p` ajuda).
2. Título no imperativo, até 60 caracteres, dizendo o que muda ("Corrige total do carrinho com cupom").
3. Corpo (se precisar): por que a mudança foi feita e o que a pessoa precisa saber.
4. Se o projeto usa Conventional Commits, prefixe (`fix:`, `feat:`, `docs:`).
5. Revise com `git diff --staged` antes de commitar.
## Checklist
- Título no imperativo e curto.
- Um assunto por commit.
- Corpo com o porquê quando não é óbvio.
- Conferência com diff --staged.
## Exemplo
Entrada: "mudei o CSS do botão e corrigi o cálculo do frete"
Saída: dois commits: "Corrige frete grátis acima de R$ 200" e "Aumenta contraste do botão de compra".
## Erros comuns
- "ajustes", "update", "wip".
- Um commit com 15 assuntos.
- Commitar arquivos de teste temporários.
