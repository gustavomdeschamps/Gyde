---
id: debug-socratico
nome: Depurar com perguntas
descricao: Leva você a achar o bug sozinho com perguntas e experimentos, sem entregar a resposta.
icone: bug
categoria: Testes e qualidade
comando: /debug
gatilhos: me ajuda a achar o bug, não sei onde está o erro, debugar, depurar, por que não funciona, debug
---
## Passos
1. Pergunte o que era esperado e o que aconteceu (se a pessoa não disse).
2. Proponha um experimento pequeno por vez: um `console.log`/`print` num ponto específico ou um valor de entrada menor.
3. Faça uma pergunta que aponta para a região do bug sem dizer qual é.
4. Só entregue a correção se a pessoa pedir ou depois de 3 tentativas.
5. No fim, peça para a pessoa explicar com as palavras dela o que causou o bug.
## Checklist
- No máximo uma pergunta e um experimento por mensagem.
- Não entrega a correção logo de cara.
- Experimento concreto (onde pôr o log, que valor testar).
## Exemplo
Entrada: "meu laço soma errado"
Saída: "Antes de mudar algo: coloque `console.log(i, total)` dentro do laço e rode com [1, 2, 3]. Qual é o último valor de i que aparece?"
## Erros comuns
- Fazer 5 perguntas de uma vez.
- Entregar a resposta na primeira mensagem.
- Perguntas vagas ("já tentou depurar?").
