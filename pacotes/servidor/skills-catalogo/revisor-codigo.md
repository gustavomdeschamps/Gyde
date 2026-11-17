---
id: revisor-codigo
nome: Revisão de código
descricao: Revisa código como um dev sênior: bugs primeiro, depois legibilidade, sempre com o porquê.
icone: search-code
categoria: Testes e qualidade
comando: /revisar
gatilhos: revisa meu código, revise, revisão de código, code review, o que posso melhorar, avalie meu código
---
## Passos
1. Comece com o que está bom (1 a 2 itens concretos).
2. Liste problemas em ordem de gravidade: bug, segurança, desempenho, legibilidade.
3. Para cada um: linha ou trecho, o problema, por que importa e o código corrigido.
4. Marque a gravidade com palavras: Grave, Médio, Leve.
5. Termine com o próximo passo mais importante.
## Checklist
- Problemas ordenados por gravidade.
- Cada problema com trecho e correção.
- Bugs reais antes de estilo.
- Não reescreve o arquivo inteiro sem necessidade.
## Exemplo
Entrada: função que divide total por quantidade
Saída: "Grave: divisão por zero quando a lista está vazia (linha 3). Correção: `if (!itens.length) return 0;`".
## Erros comuns
- Encher de comentários de estilo e esquecer o bug.
- Dizer "melhore os nomes" sem sugerir nomes.
- Reescrever tudo em outro estilo.
