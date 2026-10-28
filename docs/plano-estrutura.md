# Plano: estrutura nova do Gyde

Objetivo: TypeScript em tudo, contratos compartilhados entre servidor e telas, interface em componentes, banco com
migrações, app de desktop com instalador e atualização automática, e um monorepo. Migração em etapas: depois de cada
sessão o Gyde continua funcionando e todos os testes passam. Trabalho no ramo `estrutura-nova`.

| # | Sessão | Entrega | Verificação | Estado |
|---|---|---|---|---|
| 1 | Base em TypeScript | tsconfig estrito, `tsc` no `npm test`, servidor em `.ts` rodando direto no Node 24 (sem build) | `npm test` + `tsc` + suítes de ponta a ponta | feito |
| 2 | Contratos com Zod | `contratos.ts` com o formato das respostas (Prática, Forja, uso, status, configurações); servidor e testes validam | testes de contrato por rota | feito |
| 3 | Interface com Vite + Svelte | build da interface; telas migradas uma a uma (Forja, Prática, Configurações, Chat, Skills/Turmas) usando os contratos | regressão no navegador + capturas | feito |
| 4 | Banco com migrações | migrações numeradas e versionadas, consultas tipadas (Drizzle se suportar `node:sqlite`) | banco antigo migra sem perda (cópia) | pendente |
| 5 | App de desktop (Electron) | janela própria, pasta nativa (sai o PowerShell), servidor embutido, instalador Windows, atualização automática configurada sem publicar | abrir, conectar pasta, tarefa da Forja | pendente |
| 6 | Monorepo | `pacotes/` com app, desktop, compartilhado e as duas extensões (workspaces do npm) | todas as suítes + build das extensões | pendente |
| 7 | Limpeza e documentação | sai o que o instalador substitui; README, COMO-INSTALAR e capturas | instalação do zero numa pasta limpa | pendente |
| 8 | Revisão e publicação | segurança, diff, junção ao `main` | push e release só com OK do Gustavo | pendente |

Regras: não quebrar o que funciona, não inventar dados, nada de push ou release sem autorização, segredos fora do
repositório.
