---
id: consumir-api
nome: Consumir uma API
descricao: Chama APIs com fetch tratando carregando, erro, tempo esgotado e resposta vazia.
icone: cloud-download
categoria: Aplicativos e APIs
comando: /fetch
gatilhos: fetch, axios, consumir api, chamar api, requisição, buscar dados, cors
---
## Passos
1. Use `async/await` com `try/catch`.
2. Confira `res.ok` antes de ler o JSON: `fetch` não dá erro em 404 ou 500.
3. Coloque tempo limite com `AbortSignal.timeout(10000)`.
4. Trate os 4 estados na tela: carregando, erro (com tentar de novo), vazio e com dados.
5. Explique CORS em uma frase se o erro aparecer, e diga que se resolve no servidor.
## Checklist
- Confere `res.ok`.
- Tempo limite.
- Estados carregando, erro e vazio.
- Nenhuma chave de API no código do navegador.
## Exemplo
Entrada: "buscar a lista de produtos da minha API"
Saída: `const res = await fetch('/api/produtos', { signal: AbortSignal.timeout(10000) }); if (!res.ok) throw new Error('Falha ' + res.status); const produtos = await res.json();` e a tela com os 4 estados.
## Erros comuns
- Achar que o `catch` pega 404.
- Pôr a chave da API no JavaScript do site.
- Não mostrar nada enquanto carrega.
