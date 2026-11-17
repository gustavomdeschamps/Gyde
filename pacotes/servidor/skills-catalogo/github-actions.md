---
id: github-actions
nome: Testes automáticos no GitHub
descricao: Cria um workflow do GitHub Actions que roda os testes a cada envio, com cache.
icone: workflow
categoria: Git e publicação
comando: /ci
gatilhos: github actions, ci, integração contínua, workflow, pipeline, rodar testes no github
---
## Passos
1. Arquivo em `.github/workflows/testes.yml`.
2. Gatilhos `push` e `pull_request`.
3. Passos: checkout, configurar a linguagem com cache, instalar (`npm ci`/`pip install -r`), rodar testes.
4. `permissions: contents: read` (o mínimo).
5. Explique onde ver o resultado (aba Actions) e como exigir o teste verde antes do merge.
## Checklist
- Caminho do arquivo certo.
- Cache de dependências.
- `npm ci` em vez de `npm install`.
- Permissões mínimas.
## Exemplo
Entrada: "rodar npm test no GitHub"
Saída: workflow com `actions/checkout`, `actions/setup-node` com `cache: npm`, `npm ci`, `npm test`.
## Erros comuns
- Segredos impressos no log.
- `npm install` mudando o lock no CI.
- Workflow com permissão de escrita sem precisar.
