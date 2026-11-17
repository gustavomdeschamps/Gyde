# Novidades do Gyde

As extensões seguem a versão do app desde a 2.1.0. Histórico da extensão do VS Code:
[pacotes/extensao-vscode/CHANGELOG.md](pacotes/extensao-vscode/CHANGELOG.md).

## 2.4.1

### Medição por resultado: só fica o que ajuda de verdade
- A medição da 2.4.0 conferia sobretudo se a resposta seguia o formato da própria skill. A nova usa 38 tarefas separadas
  (não usadas para escrever as skills) e confere o resultado: o código roda com testes escondidos, a consulta SQL devolve
  o certo, a página passa no axe-core, os comandos de git funcionam num repositório de teste. 5 execuções com e 5 sem
  cada skill e cada agente, com intervalo de incerteza.
- **Das 40 skills medidas, 5 melhoraram o resultado e ficaram:** changelog-versoes (+40 pontos), banco-no-codigo (+25),
  estatistica-basica (+20, não repetido numa rodada anterior), regex (+15, tendência) e acessibilidade-web (+7).
- **35 saíram:** 30 porque o modelo já acertava 100% sem elas, 5 porque ficaram iguais ou piores (algumas depois de
  reescritas). Elas continuam no histórico do git (versão 2.4.0).
- **Agentes:** Depurador, Testador, Revisor de segurança, Explicador para iniciantes, Documentador e Designer não
  melhoraram o resultado e saíram. Fica o Planejador, que não tem como ser medido por resultado.
- As 16 skills sem tarefa de resultado possível continuam, marcadas "Sem teste de resultado". Pacotes com menos de 2
  skills e categorias vazias saíram.
- O cartão de cada skill mostra a nota com e sem ela, as execuções e o intervalo; "tendência" quando ainda é incerto.
- Os números e as 6 correções feitas na própria medição estão em [docs/avaliacao](docs/avaliacao/README.md).

### Design
- Os pontos da Forja pensando sobem e descem em onda em vez de piscar (e ficam parados com menos movimento); o destaque
  de "Mostrar o erro" e os detalhes da Cidade trocaram o brilho colorido por contornos e sombras neutras.

## 2.4.0

### Skills que fazem diferença
- **Catálogo por objetivo:** barra "Quero..." (escreva "fazer um site" e aparece o pacote "Criar um site"), 9 pacotes que
  instalam de uma vez as skills que trabalham juntas, "Para começar", "Mais instaladas" e filtro pelas 11 categorias.
- **56 skills** (44 novas), cada uma com passos, checklist, exemplo e erros comuns. Todas foram testadas na mesma tarefa
  com e sem ela (2 ou 3 execuções de cada lado) e cumpriram mais critérios com ela; o cartão mostra o resultado. Quatro
  não melhoraram na primeira medição e foram reescritas antes de entrar.
- **Só as partes necessárias entram no pedido:** passos e checklist sempre; exemplo e erros comuns se couberem (erros
  primeiro quando a mensagem fala de erro). No máximo 2 skills por mensagem, até 1.500 caracteres cada.
- A resposta mostra **Usando a skill X**; sem skill instalada do assunto, sugere a do catálogo que ajudaria.
- Tela de Skills refeita: cartões com ícone na cor da categoria, descrição de uma linha, selo, resultado do teste e
  Instalar ou Instalada, no computador e no celular, claro e escuro.

### Agentes especializados
- Depurador, Testador, Revisor de segurança, Explicador para iniciantes, Documentador, Designer de interface e
  Planejador: escolhidos por regras só quando o pedido precisa, sem chamada a mais, e mostrados na resposta. Todos
  cumpriram mais critérios com o papel na avaliação; Designer e Planejador deixam a resposta cerca de 2 vezes mais lenta.

### Ícones, sem emoji
- Um conjunto único de ícones (Lucide, licença ISC) no app, nas duas extensões e no site, com o mesmo traço e tamanho.
  Ícone decorativo fica escondido do leitor de tela; botão só com ícone tem nome acessível.
- Nenhum emoji ou caractere solto como ícone (como a marca de certo, a estrela ou o sinal de parágrafo) nas telas; as
  respostas da IA também perdem esses símbolos.

### Correções
- A Cidade mostra o arquivo que a Forja leu mesmo quando é aberta um instante depois (2.3.0).

## 2.3.0

### Forja
- A ação escrita no texto pelo modelo (`<tool_call>...`) vira ação, em vez de encerrar a tarefa no meio.
- Um texto que só anuncia o próximo passo ("Desculpe, vou ler os arquivos") não é mais aceito como resposta final.
- Contexto enxuto: o conteúdo dos arquivos mais prováveis do pedido (escolhidos com o mapa da Cidade: até 3 pequenos e até
  2 que eles importam) já vai no começo. Nas medições, a Forja passou a ler cerca de metade dos arquivos.
- Opção **Mostrar o plano da Forja antes de tarefas grandes** (Configurações > IA e modelos), desligada: a Forja escreve as
  etapas e espera você aprovar. Na medição, não acertou mais e usou mais rodadas.
- Avaliação com 4 cenários difíceis e testes escondidos. Os números estão em [docs/avaliacao](docs/avaliacao/README.md).

### Segurança dos scripts de limpeza
- Os scripts de limpeza só apagam o que está numa lista explícita de caminhos permitidos e nunca seguem atalhos
  (junction): o destino de um atalho fica intacto. Vale para as ferramentas do repositório e para o `limpar-antigos.ps1`.
  Um teste novo falha se algum deles apagar fora da lista.

## 2.2.0

### Novidades
- **"Pedir à Forja" na Cidade:** clique num prédio e o cartão do arquivo mostra **Pedir à Forja** ("Analise o arquivo X e
  sugira melhorias") e opções rápidas: explicar, simplificar, achar bugs e adicionar testes. Nos faróis (os arquivos que
  mais mudam) aparece também **dividir em partes menores**. O pedido só é escrito no campo da Forja: quem envia é você.
- **"Pedir à Forja" no VS Code:** botão direito num arquivo (no editor ou no Explorer), escolha o pedido e confira o texto.
  A extensão só guarda o pedido no app: ele aparece num cartão, **Abrir na Forja** abre a Forja daquela pasta com o pedido
  escrito e o envio continua sendo o seu clique. O token ganhou só essa rota, que não roda nada, não conecta pasta
  sozinha e não deixa ler nem apagar o pedido.
- **Avisos nas extensões logo ao abrir:** se a IA do app não está conectada, o painel já avisa no primeiro clique (antes da
  primeira pergunta); se o app está numa versão mais antiga que a extensão, o painel pede para atualizar o app.

### Correções
- **Parar no chat:** a resposta parcial às vezes sumia da tela ao clicar em **Parar** (a tela recarregava a conversa antes
  de o servidor gravar o que já tinha chegado). Agora quem encerra é o servidor, que grava e manda o fim pela mesma
  conexão. Era também a causa do teste automático que falhava de vez em quando.
- **Segurança da Forja:** a regra que impede escolher a pasta de dados do Gyde comparava caminhos de jeitos diferentes; com um
  nome curto do Windows (ex.: `RUNNER~1`) ou um atalho de pasta, ela deixava passar. Agora compara pelo caminho real e
  também recusa uma pasta que contenha os dados do Gyde (conversas, contas e chaves).
- Tela "Abrindo o Gyde": a barra de carregamento não desliza mais sem parar; só muda de brilho (e fica parada com "menos
  movimento" ligado).
- Página do Gyde: mais espaço dentro da tabela de resultados e prévia com imagem ao compartilhar o link.

### Repositório
- Modelos de issue em português (**Algo deu errado** e **Tenho uma ideia**), descrição e tópicos, e uma imagem de
  divulgação com a Cidade do código (`docs/imagens/divulgacao.jpg`).

## 2.1.0

### Novidades
- **Conectar IA sem programa extra:** em **Configurações > Conectar IA**, você cola uma chave grátis da **NVIDIA** ou do
  **Google** e o Gyde testa na hora (uma chamada de verdade) antes de salvar. O **Groq** é opcional: deixa o chat mais
  rápido e serve de reserva. A chave nunca volta para a tela depois de salva. O FreeLLMAPI continua em **Avançado**, para
  quem já usa. A tela avisa que a chave precisa ser criada por alguém com 18 anos ou mais, a regra de privacidade do
  plano grátis do Google e que o teste grátis da NVIDIA pode mudar.
- **Gyde 1 e Gyde 1 Pro:** a lista do chat mostra só as opções do Gyde. Quem escolhe o modelo de verdade é o roteador, que
  usa a lista de modelos ao vivo de cada provedor e as medições. Embaixo de cada resposta aparece o modelo que respondeu.
- **Inteligência multimodelo:** o Gyde entende o tipo de pedido e escolhe o modelo que foi melhor naquela tarefa nas
  avaliações, trocando sozinho se ele falhar ou estiver no limite. Em **Configurações > IA e modelos**: Rápido,
  Equilibrado (o padrão) e Capricho. Provedor novo entra por um arquivo ([docs/inteligencia.md](docs/inteligencia.md)).
- **Ao vivo para qualquer projeto:** o Gyde descobre como ligar o projeto (React, Vue, Vite, Next, Nuxt, Astro, Angular,
  site de HTML, Python, Java, C#, Go, Rust), mostra o comando exato e só roda depois do seu clique. Projetos web abrem ao
  lado da conversa (só em 127.0.0.1, numa porta livre); pasta de build pronta é servida com a raiz certa; programas de
  console mostram a saída ao vivo. Erros vêm explicados em português, com **Pedir à Forja para consertar**. Fechar o
  painel ou o Gyde encerra tudo o que o Ao vivo ligou, e um fechamento forçado é limpo na abertura seguinte.
- **Cidade do código:** a pasta conectada à Forja vira uma cidade em 3D (pasta = bairro, arquivo = prédio, altura =
  tamanho, cor = quantas vezes mudou no git, faróis nos mais alterados), com lista em texto como alternativa acessível.
  Quando a Forja lê, edita, cria ou apaga um arquivo, o prédio acende na hora. Roda em placa de vídeo integrada (desenha
  direto na tela); extras como o bloom só ligam sozinhos depois de uma checagem de segurança. **Copiar diagnóstico** junta
  placa de vídeo, checagens e tempos de quadro, sem dados pessoais.
- **Forja:** outro modelo lê as mudanças antes de terminar. Quem mexe nos arquivos é sempre um modelo só.
- **Passo a passo com a memória desenhada:** pilha de chamadas, listas, dicionários e objetos em caixas, com setas.
- **Mostrar o erro:** num print enviado no chat, um modelo com visão destaca a região do problema e explica.
- **Extensões 2.1.0** (VS Code e Chrome): só Gyde 1 e Gyde 1 Pro, o modelo que respondeu embaixo da resposta, e um aviso
  em português quando a IA do app ainda não está conectada. O token das extensões só serve para conversar.
- Página do Gyde em `docs/index.html`, com os números das medições de 09/11/2026.

### Removido
- Prática e tudo o que dependia dela: trilhas, exercícios, projetos guiados, plano de estudos, XP, desafio do dia, amigos
  e Turmas. O questionário de nível continua (Configurações > Geral) e adapta as respostas do chat. O progresso antigo não
  é apagado do banco, só deixa de aparecer.
- A prévia antiga do Ao vivo (só arquivos prontos, num endereço do próprio Gyde), substituída pelo Ao vivo novo.
- O vídeo tutorial de instalação, que mostrava o fluxo antigo com o FreeLLMAPI. O passo a passo com as telas atuais está
  no [COMO-INSTALAR.md](COMO-INSTALAR.md).

### Correções
- Uma chave do FreeLLMAPI errada fazia a tela voltar para o login. Agora aparece um aviso claro.
- Título de conversa não fica mais como "Nova conversa" quando um modelo está no limite.
- Conversas longas e imagens antigas não travam mais os modelos grátis: cada um recebe só a parte da conversa que importa.
- Erro 400 do Groq em pedidos da Forja (a ação vinha no lugar errado): agora é entendida.

## 2.0.1

Correções achadas pelo CI do GitHub (Windows, Linux e macOS), que agora passa nos três sistemas.

### Correções
- Chat: depois de **Parar** e abrir uma conversa nova, a resposta da conversa antiga podia aparecer na nova.
- Forja: uma pasta com nome curto do Windows no caminho (ex.: `C:\Users\RUNNER~1`) era tratada como "fora da pasta do
  projeto", e a Forja recusava arquivos comuns.
- Relatório de erro no Linux e no macOS: o nome do usuário aparecia nos caminhos copiados.
- Forja: pede uma vez para fazer o trabalho quando o pedido manda mudar algo e o modelo tenta terminar sem ter mudado
  nenhum arquivo nem rodado nenhum comando.

### Segurança
- O pacote `deepmerge` (usado só para gerar a interface) tinha o alerta GHSA-gcqx-w48m-w2h4, sem versão corrigida. Foi
  trocado por uma versão local com a mesma interface, que ignora `__proto__`, `constructor` e `prototype`.
  `npm audit`: 0 vulnerabilidades.

### Outros
- Vídeo de abertura recodificado (26 MB para 14 MB, sem perda visível): instalador 12 MB menor.
- Tutorial em vídeo com capturas reais da página do GitHub nos passos 2 e 3.

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
