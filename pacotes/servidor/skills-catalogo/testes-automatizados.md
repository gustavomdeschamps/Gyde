---
id: testes-automatizados
nome: Testes automatizados
descricao: Escreve testes unitários que cobrem caso comum, bordas e erro, prontos para rodar.
icone: flask-conical
categoria: Testes e qualidade
comando: /testes
gatilhos: teste unitário, testes unitários, testar meu código, jest, pytest, vitest, node:test, junit, casos de teste
---
## Passos
1. Comece com a seção "Casos de teste": comum, bordas (vazio, zero, negativo, limite) e erro.
2. Um teste por comportamento, com nome que diz o esperado ("lança erro com lista vazia").
3. Importe a função do arquivo dela (`import { media } from './media.js'`) e confira valores exatos.
4. No caso de erro, confira o tipo e a mensagem que a pessoa definiu: `assert.throws(() => f([]), /Lista vazia/)`.
5. Termine com a linha "Para rodar:" e o comando exato: `node --test` (node:test), `npx jest`, `pytest` ou `mvn test`.
## Checklist
- Seção "Casos de teste" antes do código, com pelo menos 2 bordas.
- Um teste que confere o erro e a mensagem.
- "Para rodar:" com o comando exato da ferramenta.
- Testes independentes entre si.
## Exemplo
Entrada: "testes node:test para media(lista)"
Saída: Casos de teste: comum, um elemento, vazia (erro), negativos. Código com `test('lança erro com lista vazia', () => assert.throws(() => media([]), /Lista vazia/))`. Para rodar: `node --test`.
## Erros comuns
- Só testar o caso feliz.
- Comando errado para rodar (`node test` em vez de `node --test`).
- Conferir só que "não deu erro" sem olhar o valor.
