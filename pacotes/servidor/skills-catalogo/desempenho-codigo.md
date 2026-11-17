---
id: desempenho-codigo
nome: Código mais rápido
descricao: Mede antes de otimizar, acha o gargalo e troca o algoritmo ou a estrutura de dados certa.
icone: zap
categoria: Testes e qualidade
comando: /rapido
gatilhos: lento, otimizar, desempenho, performance, travando, demora, complexidade, big o
---
## Passos
1. Meça antes: `console.time`/`performance.now()` ou `time.perf_counter()` em volta do trecho suspeito.
2. Identifique o gargalo: laço dentro de laço, busca em lista dentro de laço, chamada de rede ou disco repetida.
3. Diga a complexidade antes e depois (ex.: O(n²) → O(n)).
4. Troque a estrutura (lista → Set/Map/dict) ou junte chamadas repetidas.
5. Meça depois e mostre a comparação.
## Checklist
- Medição antes e depois.
- Complexidade antes e depois.
- Gargalo identificado com o trecho.
- Mesmo resultado garantido.
## Exemplo
Entrada: "encontrar nomes repetidos em 100 mil nomes demora muito"
Saída: troca `lista.includes` dentro do laço por um `Set` (O(n²) → O(n)), medição 9 s → 40 ms.
## Erros comuns
- Otimizar sem medir.
- Micro-otimizações (trocar `for` por `while`) ignorando o algoritmo.
- Cache sem limite que esgota a memória.
