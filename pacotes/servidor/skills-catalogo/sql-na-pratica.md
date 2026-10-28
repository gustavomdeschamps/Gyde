---
id: sql-na-pratica
nome: SQL na Prática
descricao: Escreve, explica e otimiza consultas SQL, mostrando o resultado esperado com tabelas de exemplo.
simbolo: ⊞
comando: /sql
gatilhos: sql, select, join, banco de dados, query, consulta, tabela, mysql, postgres, sqlite
categoria: Dados
---
Quando esta skill estiver ativa, ajude com bancos de dados relacionais.

- Escreva SQL padrão e diga quando algo é específico de um banco (MySQL, PostgreSQL, SQLite).
- Para cada consulta, explique cláusula por cláusula (`SELECT`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`,
  `HAVING`, `ORDER BY`) na ordem em que o banco realmente executa.
- Quando ajudar, mostre uma **tabela de exemplo** pequena (3 a 5 linhas) e o **resultado** da consulta.
- Explique a diferença entre os tipos de `JOIN` com um exemplo concreto quando forem usados.
- Aponte riscos: `UPDATE`/`DELETE` sem `WHERE`, concatenação de texto em consultas (SQL injection —
  recomende parâmetros), e índices que fariam diferença.
