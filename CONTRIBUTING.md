# Como contribuir com o Gyde

Obrigado por querer ajudar. Ideias e problemas: abra uma [issue](https://github.com/gustavomdeschamps/Gyde/issues).
Para mudar o código, faça um fork, crie um ramo, rode os testes e abra um pull request explicando o que mudou e por quê.

## Preparar

Precisa do Node.js 22.18 ou mais novo (ele roda TypeScript direto, sem compilar).

```bash
npm install
npm run build
npm start
```

O Gyde abre em http://127.0.0.1:3210. Para o app de desktop: `npm run desktop`.

## Onde fica cada coisa

| Pasta | O quê |
|---|---|
| `pacotes/servidor` | Express + SQLite do Node. `server.ts` só monta os módulos (`chat.ts`, `codigo-agente.ts`, `pratica-servidor.ts`...) |
| `pacotes/interface` | Svelte 5 + Vite. `src/main.ts` é a casca; cada tela tem a sua pasta |
| `pacotes/compartilhado` | `contratos.ts`: o formato de cada resposta, usado pelos dois lados |
| `pacotes/desktop` | Electron |
| `pacotes/extensao-vscode`, `pacotes/extensao-chrome` | Extensões |
| `testes-e2e` | Testes de navegador |

## Testes

```bash
npm test          # tipos, ESLint e testes automáticos (sem internet)
npm run build
npm run e2e       # testes de navegador (precisa do Chrome ou do Edge)
npm run e2e -- chat   # só as suítes com "chat" no nome
```

Os testes de navegador sobem um servidor próprio numa pasta temporária e usam um FreeLLMAPI falso: não precisam de
chave nem de internet (só a Prática baixa o Python do navegador na primeira vez). O CI do GitHub roda tudo isso em
Windows, Linux e macOS.

## Regras do projeto

- **Português** nos nomes, comentários, mensagens e commits. Sem emojis.
- **Resposta nova da API → contrato novo** em `pacotes/compartilhado/contratos.ts`, e o servidor responde com
  `responder(res, Contrato, dados)`.
- **Mudou o banco → migração nova** no fim de `pacotes/servidor/migracoes.ts`. Nunca edite uma migração que já saiu.
- **Mudou algo que a pessoa vê → teste de navegador** em `testes-e2e`.
- Nada de `.env`, `data/`, chaves ou tokens nos commits. Chaves de teste ficam montadas dentro dos próprios testes.
- A Forja mexe em arquivos de verdade: qualquer mudança nela passa pela proteção de `seguranca.ts`.
