---
id: banco-no-codigo
nome: Banco de dados no código
descricao: Conecta o app ao banco com consultas parametrizadas, transações e conexões fechadas.
icone: database-zap
categoria: Banco de dados
comando: /banco
gatilhos: conectar banco, sqlite no node, mysql no python, orm, prisma, consulta parametrizada, transação
---
## Passos
1. Use sempre consulta parametrizada (`?` ou `$1`), nunca juntar texto com a entrada.
2. Agrupe operações que dependem uma da outra numa transação (BEGIN/COMMIT, ROLLBACK no erro).
3. Feche ou devolva a conexão (pool) mesmo quando dá erro (`finally`).
4. Credenciais em variáveis de ambiente.
5. Mostre a criação da tabela, uma inserção e uma busca.
## Checklist
- Parâmetros em todas as consultas.
- Transação quando há mais de uma escrita relacionada.
- A condição de negócio vai na própria consulta (`WHERE estoque >= ?`) e o código confere as linhas afetadas (`changes`, `rowCount`): zero linhas = "estoque insuficiente", com ROLLBACK.
- Conexão fechada no finally ou pool.
- Senha fora do código.
## Exemplo
Entrada: "salvar pedido e baixar estoque"
Saída: `BEGIN; INSERT INTO pedidos ...; UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?; COMMIT;` com ROLLBACK se o UPDATE não mudar nenhuma linha.
## Erros comuns
- `"SELECT * FROM usuarios WHERE email = '" + email + "'"`.
- Duas escritas sem transação deixando dados pela metade.
- Abrir conexão nova a cada requisição sem fechar.
