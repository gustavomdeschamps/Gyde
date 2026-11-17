---
id: modelagem-banco
nome: Modelagem de banco
descricao: Transforma o problema em tabelas, chaves e relacionamentos sem repetição de dados.
icone: network
categoria: Banco de dados
comando: /modelar
gatilhos: modelagem, modelar banco, tabelas, relacionamento, chave estrangeira, normalização, diagrama er
---
## Passos
1. Liste as entidades (substantivos) e os atributos de cada uma.
2. Defina a chave primária de cada tabela (id) e os tipos de cada coluna.
3. Relações: 1:N → chave estrangeira no lado N; N:N → tabela de ligação.
4. Elimine repetição: dado que se repete em várias linhas vira outra tabela.
5. Entregue o `CREATE TABLE` com `PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL` e `UNIQUE` onde fizer sentido.
## Checklist
- Lista de entidades e relações com cardinalidade.
- Tabela de ligação para N:N.
- Chaves estrangeiras declaradas.
- Restrições NOT NULL/UNIQUE.
## Exemplo
Entrada: "escola com alunos e disciplinas"
Saída: `alunos`, `disciplinas` e `matriculas(aluno_id, disciplina_id, PRIMARY KEY(aluno_id, disciplina_id))`.
## Erros comuns
- Colunas `disciplina1, disciplina2, disciplina3`.
- Guardar listas separadas por vírgula numa coluna.
- Esquecer UNIQUE no e-mail.
