---
id: documentar-api
nome: Documentar uma API
descricao: Documenta cada rota com método, parâmetros, exemplo de pedido e de resposta e erros.
icone: file-braces
categoria: Documentação
comando: /docapi
gatilhos: documentar api, documentação da api, swagger, openapi, postman, contrato da api
---
## Passos
1. Uma seção por rota: método e caminho no título.
2. Tabela de parâmetros: nome | onde (caminho, query, corpo) | tipo | obrigatório | descrição.
3. Exemplo de pedido com curl e exemplo de resposta em JSON.
4. Lista de erros com código e quando acontece.
5. Se pedirem, gere o trecho OpenAPI (YAML) equivalente.
## Checklist
- Tabela de parâmetros.
- Exemplo de pedido e de resposta.
- Erros com código.
- Autenticação explicada (se houver).
## Exemplo
Entrada: "POST /tarefas recebe titulo e prazo"
Saída: tabela com `titulo` (corpo, texto, sim) e `prazo` (corpo, data ISO, não); curl; resposta 201; erro 400 "titulo obrigatório".
## Erros comuns
- Exemplo de resposta diferente da real.
- Esquecer os erros.
- Não dizer o formato das datas.
