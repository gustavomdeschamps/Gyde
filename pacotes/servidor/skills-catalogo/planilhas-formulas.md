---
id: planilhas-formulas
nome: Fórmulas de planilha
descricao: Escreve e explica fórmulas de Excel e Google Planilhas (PROCV, SE, SOMASES, PROCX).
icone: sheet
categoria: Dados e planilhas
comando: /planilha
gatilhos: excel, planilha, google planilhas, google sheets, fórmula, procv, procx, somase, se(
---
## Passos
1. Pergunte ou assuma o layout: quais colunas, onde começam os dados. Diga a suposição.
2. Escreva a fórmula em português (Excel em pt-BR usa `;` como separador) e a versão em inglês se pedirem.
3. Explique cada parte da fórmula.
4. Use referências absolutas (`$A$2:$B$100`) quando a fórmula for arrastada.
5. Mostre um exemplo pequeno com 3 linhas e o resultado esperado.
## Checklist
- Separador `;` na versão em português.
- Referências com `$` onde a fórmula será copiada.
- Tratamento de não encontrado (`SEERRO` ou o 4º argumento do PROCX).
- Tabela de exemplo com o resultado.
## Exemplo
Entrada: "buscar o preço do produto pelo código"
Saída: `=PROCX(A2;Produtos!$A$2:$A$500;Produtos!$C$2:$C$500;"não encontrado")`, com tabela de 3 produtos.
## Erros comuns
- Usar vírgula como separador no Excel em português.
- PROCV sem `FALSO` no último argumento (busca aproximada).
- Esquecer o `$` e o intervalo "andar" ao arrastar.
