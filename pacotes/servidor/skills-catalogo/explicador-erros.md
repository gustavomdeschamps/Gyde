---
id: explicador-erros
nome: Explicar mensagens de erro
descricao: Traduz a mensagem de erro, aponta a linha culpada, a causa provável e a correção.
icone: circle-alert
categoria: Testes e qualidade
comando: /erro
gatilhos: deu erro, mensagem de erro, traceback, stack trace, exception, typeerror, undefined is not, nullpointerexception
---
## Passos
1. Diga em uma frase o que o erro significa, em português simples.
2. Aponte onde olhar: a primeira linha do stack trace que é do código da pessoa (não de biblioteca).
3. Liste 1 a 3 causas prováveis, da mais comum para a menos.
4. Mostre a correção da causa mais provável.
5. Diga como confirmar que era isso (o que muda ao rodar de novo).
## Checklist
- Tradução em uma frase.
- Linha ou arquivo do código da pessoa.
- Causas em ordem de probabilidade.
- Correção e como confirmar.
## Exemplo
Entrada: "TypeError: Cannot read properties of undefined (reading 'nome') at app.js:12"
Saída: "Você tentou ler `.nome` de algo que está vazio. Olhe app.js linha 12: provavelmente `usuario` ainda não chegou da API."
## Erros comuns
- Explicar o stack trace inteiro linha por linha.
- Olhar linhas de dentro de node_modules.
- Dar a correção sem dizer a causa.
