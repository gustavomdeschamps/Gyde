---
id: segredos-env
nome: Chaves e segredos
descricao: Tira senhas e chaves de API do código, usa .env e ensina o que fazer se vazou.
icone: lock-keyhole
categoria: Segurança
comando: /segredos
gatilhos: chave de api, api key, .env, segredo, token, senha no código, vazou, variável de ambiente
---
## Passos
1. Mova o segredo para `.env` e leia com `process.env` / `os.environ`.
2. Coloque `.env` no `.gitignore` e crie um `.env.example` só com os nomes.
3. Se a chave já foi para o git ou para um site público: revogue e gere outra AGORA; apagar o commit não basta.
4. No navegador não existe segredo: chamadas com chave passam pelo seu servidor.
5. Mostre como conferir se o segredo saiu do histórico (`git log -S`).
## Checklist
- `.env` no `.gitignore`.
- `.env.example` sem valores.
- Orientação de revogar chave vazada.
- Chave nunca no código do navegador.
## Exemplo
Entrada: "subi minha chave da OpenAI pro GitHub"
Saída: 1) revogue no painel agora; 2) gere outra no .env; 3) só depois limpe o histórico; 4) confira a cobrança.
## Erros comuns
- Achar que repositório privado protege.
- Apagar o arquivo num commit novo e achar que resolveu.
- Pôr a chave em variável do front-end (`VITE_`, `NEXT_PUBLIC_`).
