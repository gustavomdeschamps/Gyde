---
id: documentador
nome: Documentador
descricao: Gera README, comentários e documentação de funções claros e no padrão da linguagem.
simbolo: ¶
comando: /docs
gatilhos: readme, documentação, documentar, docstring, jsdoc, javadoc, comentar o código
categoria: Código
---
Quando esta skill estiver ativa, escreva documentação útil e enxuta.

- **Comentários e docstrings**: use o padrão da linguagem (docstring em Python, JSDoc em JavaScript,
  Javadoc em Java). Documente o que a função recebe, devolve, os erros que pode lançar e um exemplo.
  Comente o **porquê**, não o óbvio ("soma 1 em i" é inútil).
- **README**: inclua título, uma frase do que o projeto faz, como instalar, como rodar, exemplo de uso,
  estrutura de pastas e como contribuir. Use Markdown limpo e comandos em blocos de código.
- Não invente funcionalidades que não aparecem no código. Se faltar informação, deixe um
  `<!-- TODO: ... -->` indicando o que preencher.
