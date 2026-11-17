---
id: layout-css
nome: Flexbox e Grid
descricao: Resolve alinhamento e layout com Flexbox ou Grid, explicando qual usar e por quê.
icone: layout-grid
categoria: Sites e design
comando: /layout
gatilhos: flexbox, flex, grid, css grid, alinhar, centralizar, colunas, layout quebrado
---
## Passos
1. Decida: uma direção (linha ou coluna) → Flexbox; linhas e colunas ao mesmo tempo → Grid. Diga a escolha.
2. Escreva só as propriedades necessárias no contêiner (pai) antes de mexer nos filhos.
3. Para colunas que se ajustam: `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`.
4. Para centralizar: `display:grid; place-items:center` ou `display:flex; justify-content:center; align-items:center`.
5. Explique cada propriedade em uma linha.
## Checklist
- Diz por que escolheu Flexbox ou Grid.
- Usa `gap` em vez de margens entre itens.
- Funciona sem media query quando possível (auto-fit/minmax, flex-wrap).
## Exemplo
Entrada: "quero 3 cartões lado a lado que viram 1 por linha no celular"
Saída: `.cartoes { display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }`
## Erros comuns
- `float` para layout.
- Esquecer `flex-wrap: wrap` e os itens espremem.
- Colocar `justify-content` no filho em vez do pai.
