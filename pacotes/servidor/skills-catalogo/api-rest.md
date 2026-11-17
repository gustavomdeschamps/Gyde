---
id: api-rest
nome: API REST
descricao: Desenha rotas, códigos HTTP e formatos de resposta de uma API REST consistente.
icone: plug
categoria: Aplicativos e APIs
comando: /api
gatilhos: api, rest, endpoint, rota, http, json, crud, back-end, backend
---
## Passos
1. Liste os recursos (substantivos no plural): `/tarefas`, `/usuarios`.
2. Monte a tabela método | rota | o que faz | código de sucesso.
3. Use os códigos certos: 200 leitura, 201 criação, 204 sem conteúdo, 400 dado inválido, 401 sem login, 403 sem permissão, 404 não existe, 409 conflito.
4. Padronize o erro: `{ "erro": "mensagem para a pessoa" }`.
5. Escreva o código de uma rota completa com validação e o teste com curl.
## Checklist
- Tabela de rotas.
- Rotas com substantivos, sem verbos (`/tarefas`, não `/criarTarefa`).
- 201 na criação e 404 quando não existe.
- Validação da entrada com 400.
- Exemplo de chamada com curl.
## Exemplo
Entrada: "API de tarefas"
Saída: GET /tarefas 200, POST /tarefas 201, PATCH /tarefas/:id 200, DELETE /tarefas/:id 204; curl -X POST ... -d '{"titulo":"Estudar"}'.
## Erros comuns
- Responder 200 com `{ "erro": ... }`.
- Verbos na URL.
- Devolver a senha ou dados internos no JSON.
