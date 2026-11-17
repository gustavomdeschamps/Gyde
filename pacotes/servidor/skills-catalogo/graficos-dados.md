---
id: graficos-dados
nome: Gráficos que explicam
descricao: Escolhe o tipo certo de gráfico para a pergunta e gera o código com títulos e eixos claros.
icone: chart-line
categoria: Dados e planilhas
comando: /grafico
gatilhos: gráfico, grafico, matplotlib, chart.js, visualização, plotar, dashboard
---
## Passos
1. Escreva a pergunta que o gráfico responde.
2. Escolha pelo tipo de comparação: tempo → linha; categorias → barras horizontais ordenadas; parte do todo com poucas partes → barras empilhadas; relação entre duas medidas → dispersão.
3. Título que diz a conclusão ("Vendas caíram em março"), eixos com unidade.
4. Uma cor de destaque para o que importa; o resto em cinza.
5. Gere o código (matplotlib ou Chart.js) pronto para rodar.
## Checklist
- Justifica o tipo de gráfico.
- Título com a conclusão.
- Eixos com nome e unidade.
- Eixo Y de barras começando em zero.
## Exemplo
Entrada: "mostrar vendas por vendedor"
Saída: barras horizontais ordenadas da maior para a menor, título "Ana vendeu o dobro da média", eixo X "Vendas (R$)".
## Erros comuns
- Pizza com 10 fatias.
- Eixo cortado exagerando a diferença.
- Cores aleatórias sem significado.
