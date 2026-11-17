---
id: documentador
nome: Documentar funções
descricao: Escreve comentários de documentação (JSDoc, docstring, Javadoc) com parâmetros, retorno e exemplo.
icone: file-code
categoria: Documentação
comando: /docs
gatilhos: documentar, documentação, docstring, jsdoc, javadoc, comentar o código, comentário de função
---
## Passos
1. Use o padrão da linguagem: JSDoc (`/** */`) em JS/TS, docstring em Python, Javadoc em Java.
2. Primeira linha: o que a função faz, no presente ("Calcula o frete...").
3. Cada parâmetro com tipo e significado; o retorno; os erros que pode lançar.
4. Um exemplo de uso curto.
5. Comente o porquê de trechos não óbvios, não o que cada linha faz.
## Checklist
- Formato da linguagem certo.
- Parâmetros, retorno e erros.
- Exemplo de uso.
- Nenhum comentário óbvio ("// soma a e b").
## Exemplo
Entrada: `function frete(peso, cep)`
Saída: `/** Calcula o frete em reais. @param {number} peso Peso em kg. @param {string} cep CEP de destino, só números. @returns {number} @throws {Error} Se o CEP for inválido. @example frete(2, '88000000') // 23.5 */`
## Erros comuns
- Comentar cada linha.
- Documentação que não bate com o código.
- Esquecer os erros possíveis.
