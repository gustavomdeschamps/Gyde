# Novidades do Gyde

As extensões têm o próprio histórico: [VS Code](pacotes/extensao-vscode/CHANGELOG.md). A extensão do Chrome segue a
versão do `manifest.json`.

## 2.0.0

Reestruturação completa do código, instalador de verdade para o Windows, projetos guiados para todas as linguagens
do questionário, Forja mais cuidadosa e muitos testes novos. As telas continuam com a mesma cara.

### Novo
- **Instalador do Windows** (`Gyde-Setup-2.0.0.exe`): instala só para o seu usuário, sem administrador, sem terminal
  e sem Node.js; cria os atalhos no menu Iniciar e na Área de Trabalho e abre o Gyde no fim. Atualizar por cima
  mantém os dados; desinstalar pergunta antes de apagar os seus dados (e nunca apaga numa atualização).
- **App de desktop** (Windows): janela própria, abre e fecha o servidor sozinho (porta 3210 ou outra livre), uma
  instância só, tela "Abrindo o Gyde…", avisos com **Tentar de novo** e **Abrir o registro** quando algo falha,
  registro de diagnóstico sem chaves (Configurações > Geral > Registros do app), seletor de pasta nativo na Forja,
  dados em `%APPDATA%\Gyde` e atualização pelo GitHub. Configurado também para Mac (`.dmg`) e Linux
  (`AppImage`/`.deb`), ainda sem teste nesses sistemas.
- **Projetos guiados para as 10 tecnologias do questionário** (Python, JavaScript, Java, C/C++, C#, PHP, HTML e CSS,
  SQL, Kotlin e Lógica), com objetivo, pré-requisitos, arquivos iniciais, etapas, critérios conferidos pelo Gyde,
  dicas, explicação da solução e próximos desafios. Entram no plano de cada pessoa.
- **Vídeo tutorial de instalação** em `docs/tutorial/`, gravado com o instalador e o app reais.
- **Trazer os dados do Gyde antigo** para o app de desktop, na tela de entrada.
- **Cópia de segurança:** baixar e restaurar tudo (banco e imagens) em Configurações > Privacidade e dados.
- **Chaves pela tela:** a chave do FreeLLMAPI e a geração de imagens são configuradas em Configurações > IA e
  modelos (antes eram `.bat`).
- **Esqueci minha senha** no app de desktop, com confirmação numa janela do Windows.
- **Relatório de erro** para copiar (Configurações > Geral), sem conversas nem chaves.
- **Modo público** (servidor de uma turma): a tela esconde o que só o dono do servidor configura.

### Melhorias
- **Progresso de verdade na Prática:** exercício guiado só conta com a solução entregue, e etapa de projeto só conta
  (e só dá XP) quando passa nos critérios.
- **Forja:** não substitui um arquivo que não leu na tarefa, não troca um segredo real pelo marcador
  `[segredo removido]`, pede para rodar os testes quando mudou arquivos e ia terminar sem testar, sabe quais arquivos
  têm a ver com o pedido, quais são front-end e back-end, e quais têm mudanças suas ainda não salvas no git.
- **Avaliações com IA de verdade** em `ferramentas/avaliar-modelos.mjs` e `ferramentas/avaliar-forja.mjs`, com os
  resultados medidos em `docs/avaliacao/`.
- A tela nunca fica carregando para sempre: todo pedido ao servidor tem prazo e mensagem clara.
- Tudo em TypeScript estrito; interface em Svelte 5 com Vite; contratos (Zod) conferem cada resposta entre servidor
  e interface.
- Banco com migrações numeradas e cópia antes de cada atualização.
- Limite de tentativas de login guardado no banco (não zera ao reiniciar).
- O Gyde abre mais rápido: não espera mais a verificação do FreeLLMAPI e do Ollama para mostrar a tela.
- Contraste de cores e celular revisados (auditoria de acessibilidade WCAG 2.1 AA em todas as telas).
- Monorepo em `pacotes/` (servidor, interface, contratos, desktop e as duas extensões).

### Correções
- Forja: comandos com aspas chegavam deformados ao `cmd.exe` (`git commit -m "..."`, `node -e "..."`).
- Chat: depois de Parar, a conversa antiga podia voltar por cima de uma conversa nova.
- Prática de Python mostrava `true`/`false` em vez de `True`/`False`.
- Uso e limites quebrava se o FreeLLMAPI respondesse num formato diferente.
- `redefinir-senha.bat` e o ícone do atalho do instalador apontavam para caminhos antigos.

### Removido
- `iniciar.bat`, `instalar.bat` e `instalar.ps1`: o instalador substitui a instalação pelo código. Quem desenvolve usa
  `npm install`, `npm run build` e `npm start`.
- **"Instalar o Gyde como app" pelo navegador** (PWA): o atalho dependia de o servidor já estar aberto e abria abas
  repetidas. Quem ainda abre por ele recebe um aviso de como trocar pelo app de desktop.
- A pasta `configurar/` virou `ferramentas/` (e-mail do modo público, trocar senha pelo código, extensão do VS Code,
  avaliações).
- `configurar-chave`, `configurar-imagens` (substituídos pelas Configurações) e `configurar-voz`: a chave do Gemini
  que ele gravava nunca foi usada; a leitura em voz alta sempre usou a voz do Windows.

### Para quem atualiza
- O banco é atualizado sozinho na primeira abertura, com uma cópia antes em `data/copias-banco`.
- A extensão do Chrome mudou de pasta: recarregue a partir de `pacotes\extensao-chrome`.
- Quem usava pelo `iniciar.bat`: instale o app e, na tela de entrada, use **Trazer seus dados** apontando para a
  pasta antiga do Gyde. Depois remova o atalho antigo do navegador em `edge://apps`, se tiver.
