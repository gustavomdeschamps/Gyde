---
id: indices-consultas
nome: Consultas rápidas e índices
descricao: Descobre por que uma consulta está lenta e qual índice resolve, com EXPLAIN.
icone: gauge
categoria: Banco de dados
comando: /indice
gatilhos: consulta lenta, índice, index, explain, otimizar sql, desempenho do banco, query lenta
---
## Passos
1. Peça ou mostre o `EXPLAIN` (ou `EXPLAIN QUERY PLAN` no SQLite) e diga o que procurar: varredura da tabela inteira.
2. Índice nas colunas do WHERE e do JOIN, na ordem: igualdade primeiro, intervalo depois.
3. Escreva o `CREATE INDEX` com nome claro.
4. Avise o custo: índices deixam INSERT e UPDATE um pouco mais lentos e ocupam espaço.
5. Reescreva a consulta se ela impede o índice (função na coluna, `LIKE '%texto'`).
## Checklist
- Usa EXPLAIN antes e depois.
- CREATE INDEX com colunas na ordem certa.
- Cita o custo do índice.
- Aponta padrões que impedem índice.
## Exemplo
Entrada: "SELECT * FROM pedidos WHERE cliente_id = 7 AND data > '2026-01-01' está lento"
Saída: `CREATE INDEX idx_pedidos_cliente_data ON pedidos (cliente_id, data);` e o EXPLAIN mostrando o uso do índice.
## Erros comuns
- Índice em toda coluna.
- `WHERE YEAR(data) = 2026` (a função impede o índice).
- `SELECT *` trazendo colunas que não usa.
