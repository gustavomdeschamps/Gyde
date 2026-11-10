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
| `pacotes/servidor` | Express + SQLite do Node. `server.ts` só monta os módulos (`chat.ts`, `codigo-agente.ts`, `ia/orquestrador.ts`...) |
| `pacotes/interface` | Svelte 5 + Vite. `src/main.ts` é a casca; cada tela tem a sua pasta |
| `pacotes/compartilhado` | `contratos.ts`: o formato de cada resposta, usado pelos dois lados |
| `pacotes/desktop` | Electron |
| `pacotes/extensao-vscode`, `pacotes/extensao-chrome` | Extensões |
| `testes-e2e` | Testes de navegador e o teste do instalador |
| `ferramentas` | Scripts de quem cuida do projeto: e-mail do modo público, trocar senha pelo código, extensão do VS Code, avaliações com IA de verdade, imagem do instalador |

## Testes

```bash
npm test          # tipos, ESLint e testes automáticos (sem internet)
npm run build
npm run e2e       # testes de navegador (precisa do Chrome ou do Edge)
npm run e2e -- chat   # só as suítes com "chat" no nome
```

Instalador do Windows (gera o `.exe` e testa de verdade: instala uma versão antiga, usa, atualiza, desinstala e
confere atalhos, registro e dados; no fim não fica nada instalado):

```bash
npm run teste:instalacao
```

Avaliações com a IA de verdade (usam as chaves do `.env`, que nunca são mostradas; demoram minutos e gastam cota
grátis):

```bash
node ferramentas/avaliar-modelos.mjs --provedor nvidia --repeticoes 2   # modelos em tarefas do Gyde, com correção automática
node ferramentas/avaliar-forja.mjs --provedor nvidia,groq               # a Forja em projetos pequenos, conferidos no disco
```

Os testes de navegador sobem um servidor próprio numa pasta temporária e usam um provedor de IA falso: não precisam de
chave nem de internet. O CI do GitHub roda tudo isso em
Windows, Linux e macOS.

## Regras do projeto

- **Português** nos nomes, comentários, mensagens e commits. Sem emojis.
- **Resposta nova da API → contrato novo** em `pacotes/compartilhado/contratos.ts`, e o servidor responde com
  `responder(res, Contrato, dados)`.
- **Mudou o banco → migração nova** no fim de `pacotes/servidor/migracoes.ts`. Nunca edite uma migração que já saiu.
- **Mudou algo que a pessoa vê → teste de navegador** em `testes-e2e`.
- Nada de `.env`, `data/`, chaves ou tokens nos commits. Chaves de teste ficam montadas dentro dos próprios testes.
- A Forja mexe em arquivos de verdade: qualquer mudança nela passa pela proteção de `seguranca.ts`.
- **A cada atualização, remover o que ficou obsoleto** (código morto, arquivos, imagens, instaladores e cópias antigas),
  sem tocar em dados do usuário. Em commit separado, para dar para voltar, conferido com `npm test`.

  **Nunca se apaga:** `%APPDATA%\Gyde` (dados do app: o banco `gyde.db`, a pasta `data`, os registros e o `.env` do app),
  o `.env` e a pasta `data/` do projeto, e cópias de segurança com menos de 7 dias ou entre as 5 mais recentes
  (`Documentos\Gyde-backups`). Fora do repositório, quem apaga é um script que mostra a lista e pergunta antes
  (`limpar-antigos.ps1`); o script de preparar a atualização já apaga só as cópias antigas, pela mesma regra.

Vai mexer na escolha de modelos ou nas instruções da IA? Veja [docs/inteligencia.md](docs/inteligencia.md) e meça antes e depois com `ferramentas/avaliar-estrategias.mjs`.
