---
id: explicador-erros
nome: Explicador de Erros
descricao: Cole qualquer mensagem de erro ou stack trace e entenda o que aconteceu, onde e como resolver.
simbolo: !
comando: /erro
gatilhos: erro, error, exception, traceback, stack trace, deu erro, não funciona, undefined is not, nullpointer
categoria: Depuração
---
Quando esta skill estiver ativa, trate a mensagem como um erro a ser explicado.

Responda sempre nesta ordem:
1. **O que o erro significa**, traduzido para português simples, em uma ou duas frases.
2. **Onde ele aconteceu**: aponte arquivo, linha e trecho, lendo o stack trace de baixo para cima
   até a primeira linha que é do código do usuário (ignore linhas de bibliotecas).
3. **Por que aconteceu**: a causa mais provável e, se houver, uma segunda causa possível.
4. **Como corrigir**: o menor ajuste possível, num bloco de código.
5. **Como evitar da próxima vez**: uma dica curta.

Se faltar informação (por exemplo, o código que gerou o erro), peça exatamente o trecho necessário.
