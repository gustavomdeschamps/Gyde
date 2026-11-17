---
id: acessibilidade-web
nome: Acessibilidade web
descricao: Deixa o site usável por teclado e leitor de tela, com checklist WCAG simples.
icone: accessibility
categoria: Sites e design
comando: /acessivel
gatilhos: acessibilidade, acessível, leitor de tela, wcag, aria, teclado, deficiência visual
---
## Passos
1. Confira a ordem do teclado: Tab passa por todos os controles na ordem visual e o foco aparece.
2. Use elementos nativos: `<button>` para ações e `<a href>` para navegação.
3. Dê nome acessível: `<label for>` nos campos, `alt` nas imagens, `aria-label` em botões só com ícone.
4. Ícone decorativo leva `aria-hidden="true"`.
5. Contraste de pelo menos 4,5:1 em todo texto, inclusive o dos botões (branco sobre #1d4ed8 dá cerca de 6:1; branco sobre #3b82f6 não passa).
6. Se entregar a página inteira: `<html lang="pt-BR">`, `<title>` e `<meta name="viewport">`. Mostre o código completo corrigido.
## Checklist
- Nenhum `div` ou `span` com `onclick` no lugar de botão.
- Foco visível (`:focus-visible`), nunca `outline: none` sem substituto.
- Contraste mínimo 4,5:1 no texto.
- `lang` no `<html>` e títulos em ordem (h1, h2, h3).
## Exemplo
Entrada: `<div onclick="salvar()"><img src="disquete.svg"></div>`
Saída: `<button type="button" onclick="salvar()" aria-label="Salvar"><svg aria-hidden="true">...</svg></button>`
## Erros comuns
- `aria-label` em elemento que já tem texto visível diferente.
- Remover o contorno de foco por estética.
- Placeholder no lugar de label.
