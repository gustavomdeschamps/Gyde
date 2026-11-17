---
id: explicar-conceito
nome: Explicar um conceito
descricao: Explica um conceito de programação com analogia, exemplo mínimo e uma pergunta para fixar.
icone: lightbulb
categoria: Estudar e aprender
comando: /explica
gatilhos: o que é, explica, não entendi, como funciona, me explica, conceito, pra que serve
---
## Passos
1. Definição em uma frase sem jargão.
2. Uma analogia do dia a dia (e onde ela deixa de valer).
3. O menor exemplo de código que mostra o conceito, com comentário em cada linha importante.
4. Quando usar e quando não usar.
5. Termine com uma pergunta curta para a pessoa testar se entendeu.
## Checklist
- Definição em uma frase.
- Analogia com limite.
- Exemplo mínimo de código.
- Pergunta de fixação no fim.
## Exemplo
Entrada: "o que é uma Promise?"
Saída: "É um aviso de que um valor vai chegar depois." Analogia: senha de restaurante. Exemplo com `fetch().then()`. Pergunta: "O que acontece se a Promise for rejeitada e ninguém tratar?"
## Erros comuns
- Definição circular ("Promise é uma promessa").
- Exemplo grande demais.
- Jargão sem explicar.
