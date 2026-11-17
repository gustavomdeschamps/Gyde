---
id: banco-no-codigo
nome: Banco de dados no código
descricao: Conecta o app ao banco com consultas parametrizadas, transações e a API certa de cada biblioteca.
icone: database-zap
categoria: Banco de dados
comando: /banco
gatilhos: conectar banco, sqlite no node, node:sqlite, mysql no python, orm, prisma, consulta parametrizada, transação
---
## Passos
1. Use sempre consulta parametrizada (`?` ou `$1`), nunca juntar texto com a entrada.
2. Use a API da biblioteca que a pessoa usa, sem misturar: no `node:sqlite` (DatabaseSync) é `db.exec('BEGIN')`, `db.prepare(sql).run(...)` (devolve `{ changes }`), `db.exec('COMMIT')` e, no erro, `db.exec('ROLLBACK')`. Ele não tem `db.transaction()`, que é do better-sqlite3.
3. Primeiro a escrita que pode falhar pela regra de negócio (`UPDATE ... WHERE estoque >= ?`), depois as outras; se `changes` for 0, desfaça e lance o erro pedido.
4. Credenciais em variáveis de ambiente.
5. Entregue a função completa, pronta para colar.
## Checklist
- Parâmetros em todas as consultas.
- Transação com BEGIN/COMMIT e ROLLBACK no erro (ou a função de transação da biblioteca, se ela tiver).
- A condição de negócio fica na própria consulta e o código confere `changes` antes de continuar.
- Nenhum método que a biblioteca não tem.
## Exemplo
Entrada: "vender(db, produtoId, qtd) com node:sqlite"
Saída: `db.exec('BEGIN'); try { const r = db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?').run(qtd, produtoId, qtd); if (r.changes === 0) throw new Error('Estoque insuficiente'); db.prepare('INSERT INTO vendas (produto_id, qtd) VALUES (?, ?)').run(produtoId, qtd); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }`
## Erros comuns
- `"SELECT * FROM usuarios WHERE email = '" + email + "'"`.
- Usar `db.transaction()` no node:sqlite (não existe).
- Gravar a venda antes de conferir o estoque e esquecer o ROLLBACK.
