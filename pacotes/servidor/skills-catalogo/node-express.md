---
id: node-express
nome: Servidor Node com Express
descricao: Monta um servidor Express organizado, com validação, erros tratados e variáveis de ambiente.
icone: server
categoria: Aplicativos e APIs
comando: /express
gatilhos: express, node, servidor, server, nodejs, middleware, back-end em node
---
## Passos
1. `express.json()` para ler JSON e rotas separadas por recurso (`rotas/tarefas.js`).
2. Valide a entrada de cada rota e responda 400 com mensagem clara.
3. Use `async` com um tratador de erro central (`app.use((err, req, res, next) => ...)`) que responde 500 sem mostrar detalhes internos.
4. Configuração por `process.env` (porta, banco); arquivo `.env` fora do git.
5. Mostre como rodar (`node --watch servidor.js`) e testar com curl.
## Checklist
- Tratador de erro central.
- Validação com 400.
- `.env` citado no `.gitignore`.
- Porta vinda de `process.env.PORT`.
## Exemplo
Entrada: "servidor com rota de cadastro de usuário"
Saída: `app.post('/usuarios', async (req, res) => { if (!req.body.email) return res.status(400).json({ erro: 'Informe o e-mail.' }); ... res.status(201).json(usuario); })`.
## Erros comuns
- Devolver `err.stack` para o navegador.
- Esquecer `express.json()` e `req.body` vir vazio.
- Senha do banco escrita no código.
