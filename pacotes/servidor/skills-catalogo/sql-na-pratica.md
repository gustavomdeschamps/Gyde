---
id: sql-na-pratica
nome: SQL na prática
descricao: Escreve e explica consultas SQL mostrando tabelas de exemplo e o resultado esperado.
icone: database
categoria: Banco de dados
comando: /sql
gatilhos: sql, select, join, query, consulta sql, group by, mysql, postgres, sqlite
---
## Passos
1. Mostre as tabelas de exemplo (3 a 4 linhas cada) antes da consulta.
2. Escreva a consulta com palavras-chave em maiúsculas e uma cláusula por linha.
3. Explique a ordem de execução: FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY.
4. Mostre o resultado esperado em tabela.
5. Se houver JOIN, diga qual tipo (INNER, LEFT) e o que acontece com quem não tem par.
## Checklist
- Tabelas de exemplo.
- Resultado esperado.
- Tipo de JOIN justificado.
- Filtro de agregação em HAVING, não em WHERE.
## Exemplo
Entrada: "clientes que nunca compraram"
Saída: `SELECT c.nome FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id WHERE p.id IS NULL;` com as tabelas e o resultado.
## Erros comuns
- `WHERE COUNT(*) > 1` (tem que ser HAVING).
- INNER JOIN quando queria manter quem não tem par.
- Coluna no SELECT que não está no GROUP BY.
