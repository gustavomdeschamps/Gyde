---
id: front-end
nome: HTML e CSS responsivo
descricao: Páginas com HTML semântico e CSS que funciona no celular e no computador.
icone: layout-template
categoria: Sites e design
comando: /front
gatilhos: html, css, página, front-end, frontend, responsivo, layout, site
---
## Passos
1. Escreva a estrutura com tags semânticas: header, nav, main, section, footer. Nada de div para tudo.
2. Comece o CSS pelo celular (mobile first) e use `@media (min-width: 768px)` para telas maiores.
3. Use Flexbox para alinhar em uma direção e Grid para linhas e colunas.
4. Unidades: `rem` para texto, `%`, `fr` e `minmax()` para largura. Evite larguras fixas em px.
5. Entregue HTML e CSS separados, em blocos de código, e diga onde salvar cada arquivo.
## Checklist
- `<meta name="viewport" content="width=device-width, initial-scale=1">` no head.
- Toda imagem com `alt`; todo campo de formulário com `<label>`.
- Pelo menos um `@media` para telas maiores.
- Cores com contraste suficiente (texto escuro em fundo claro ou o contrário).
## Exemplo
Entrada: "faz um cabeçalho com logo e menu"
Saída: `<header>` com `<nav><ul>` e CSS com `display:flex; justify-content:space-between`, empilhando o menu abaixo de 768px.
## Erros comuns
- Esquecer o meta viewport: no celular a página aparece minúscula.
- Usar `height` fixa em caixas com texto: o texto vaza.
- Centralizar com margens em px em vez de `margin-inline: auto`.
