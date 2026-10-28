# Plano: estrutura nova do Gyde

Objetivo: TypeScript em tudo, contratos compartilhados entre servidor e telas, interface em componentes, banco com
migrações, app de desktop com instalador e atualização automática, e um monorepo. Migração em etapas: depois de cada
sessão o Gyde continua funcionando e todos os testes passam. Trabalho no ramo `estrutura-nova`.

| # | Sessão | Entrega | Verificação | Estado |
|---|---|---|---|---|
| 1 | Base em TypeScript | tsconfig estrito, `tsc` no `npm test`, servidor em `.ts` rodando direto no Node 24 (sem build) | `npm test` + `tsc` + suítes de ponta a ponta | feito |
| 2 | Contratos com Zod | `contratos.ts` com o formato das respostas (Prática, Forja, uso, status, configurações); servidor e testes validam | testes de contrato por rota | feito |
| 3 | Interface com Vite + Svelte | build da interface; telas migradas uma a uma (Forja, Prática, Configurações, Chat, Skills/Turmas) usando os contratos | regressão no navegador + capturas | feito |
| 4 | Banco com migrações | migrações numeradas (`migracoes.ts`) com `PRAGMA user_version`, transação por migração e cópia do banco antes; consultas seguem tipadas com `consulta<T>`. O Drizzle estável (0.45.4) não tem driver para `node:sqlite` (só a beta 1.0), então ficou o executor próprio | cópia do banco real migrada: 24 tabelas com a mesma contagem, `integrity_check` ok | feito |
| 5 | App de desktop (Electron) | `desktop/main.ts`: servidor num `utilityProcess` em porta livre do 127.0.0.1, dados e `.env` em `%APPDATA%\Gyde`, seletor de pasta nativo, uma instância só, links externos no navegador; chave do FreeLLMAPI nas Configurações; instalador NSIS (`npm run dist:win`, sem assinatura de código); atualização pelo GitHub configurada, nada publicado | app em desenvolvimento e empacotado: 19 checagens cada (abrir, conta, chave, Forja, fechar). Seletor de pasta nativo precisa de teste à mão | feito |
| 6 | Monorepo | workspaces do npm em `pacotes/`: `servidor`, `interface`, `compartilhado` (contratos), `desktop`, `extensao-vscode`, `extensao-chrome`. Entre pacotes as importações de `.ts` são por caminho relativo: o Node não remove tipos de arquivos dentro de `node_modules`, e é lá que o app empacotado colocaria um pacote importado pelo nome | 36 testes, 9 suítes de navegador, app de desktop (dev e empacotado), `.vsix` e `.zip` das extensões | feito |
| 7 | Limpeza e documentação | sai o `configurar-chave` (a chave agora é colada em Configurações > IA, no app e pelo código); `iniciar.bat` e `instalar.bat` ficam enquanto não houver instalador publicado. App de desktop: porta 3210 quando livre (é onde as extensões procuram) e troca de senha pela tela de entrada, com confirmação nativa. README, COMO-INSTALAR, LEIA-MEs e mensagens com os caminhos novos; extensões 1.1.1 (VS Code) e 1.2.1 (Chrome). As capturas continuam valendo: a interface não mudou de aparência | 38 testes, suítes de navegador e app de desktop | feito |
| 8 | Revisão e publicação | revisão feita: sem segredos nem arquivos pessoais no diff e nos 15 commits; rotas novas exigem login e o cabeçalho anti-CSRF; Electron com permissões restritas à página local; Zod 3 → 4 (vulnerabilidade alta). Restam 3 avisos baixos só na ferramenta de build da interface, sem correção publicada. Junção ao `main`, push e release aguardam o OK do Gustavo | todas as suítes e o app empacotado | aguardando OK |

Regras: não quebrar o que funciona, não inventar dados, nada de push ou release sem autorização, segredos fora do
repositório.
