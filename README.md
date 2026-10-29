<p align="center">
  <img src="docs/imagens/banner.jpg" alt="Gyde" width="100%">
</p>

<h3 align="center">O tutor de programação com IA que ensina em vez de só entregar a resposta.</h3>

<p align="center">
  Chat que explica o erro antes de corrigir · agente que programa sozinho no seu projeto · prática com XP ·
  app de desktop e extensões para VS Code e Chrome. Em português, de graça, rodando no seu computador.
</p>

<p align="center">
  <img alt="Grátis" src="https://img.shields.io/badge/pre%C3%A7o-gr%C3%A1tis-2563eb">
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%20%7C%2011-1e3a8a">
  <img alt="Instalador" src="https://img.shields.io/badge/instalador-sem%20administrador-3b82f6">
  <img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-5b8cff">
  <img alt="Em português" src="https://img.shields.io/badge/idioma-portugu%C3%AAs-93c5fd">
</p>

<p align="center">
  <a href="COMO-INSTALAR.md"><b>Instalar (passo a passo)</b></a> ·
  <a href="#o-que-o-gyde-faz">O que ele faz</a> ·
  <a href="#forja-o-agente-de-c%C3%B3digo">Forja</a> ·
  <a href="#uso-cotas-e-limites">Uso e limites</a> ·
  <a href="#configura%C3%A7%C3%A3o-env">Configuração</a> ·
  <a href="#testes">Testes</a> ·
  <a href="#perguntas-frequentes">Dúvidas</a>
</p>

---

## Por que o Gyde existe

Quem está começando a programar trava num erro, cola numa IA, recebe o código pronto e... não aprende nada.
O **Gyde** foi feito para o contrário: ele **mostra onde está o erro, explica o porquê e só depois corrige**,
no nível de quem está aprendendo. E quando você já sabe o que quer, a **Forja** (o agente de código do Gyde)
abre o seu projeto e faz o trabalho sozinha, como um desenvolvedor: escreve, testa, corrige e documenta.

Tudo roda **no seu computador**, com os modelos de IA **grátis** do [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi).
Suas conversas e seu progresso ficam só com você.

## O que o Gyde faz

### Chat de tutor
Cole um erro ou um código. O Gyde aponta a linha, explica a causa e mostra a correção. Os blocos de Python e
JavaScript têm o botão **Executar**, que roda o código ali mesmo.

<p align="center"><img src="docs/imagens/chat.jpg" alt="Chat do Gyde explicando um erro de Python" width="88%"></p>

### Passo a passo
O botão **Passo a passo** roda o código linha por linha e mostra o valor de cada variável a cada passo.
É o jeito mais fácil de entender um laço ou uma função.

<p align="center"><img src="docs/imagens/passo.jpg" alt="Passo a passo mostrando as variáveis linha por linha" width="88%"></p>

### Prática personalizada
Trilhas de Python, JavaScript e lógica com testes automáticos, **projetos guiados para as 10 linguagens do
questionário** (Python, JavaScript, Java, C/C++, C#, PHP, HTML e CSS, SQL, Kotlin e lógica), **XP**, **desafio do dia**,
**sequência de dias** e **revisão dos erros** (o exercício que você errou volta depois de 1, 3, 7 e 21 dias).
Travou? A **Dica do Gyde** ajuda sem entregar a resposta.

Cada conta tem o próprio plano, montado a partir de três fontes que a tela mostra separadas:
- **o que você respondeu** no questionário inicial (linguagens, objetivo, experiência, jeito de aprender);
- **o que o mini desafio mediu** (nível e assuntos para reforçar);
- **o que os exercícios mostram** (feitos, tentativas com erro, onde você travou).

Qualquer combinação de respostas gera um plano, sem depender de IA, e a tela diz qual dos quatro tipos ele é:

| Tipo | Quando | O que você recebe |
|---|---|---|
| **Trilha** | Existe trilha com testes automáticos para o que você escolheu (Python, JavaScript, lógica) | Exercícios corrigidos na hora, no navegador |
| **Plano adaptado** | Parte tem trilha e parte não (ex.: HTML e CSS) | Trilhas com testes + exercícios guiados |
| **Plano montado** | Não há trilha (Java, C / C++, C#, PHP, SQL, Kotlin) | Exercícios guiados da tecnologia, no seu nível |
| **Plano inicial** | Sem questionário ou sem escolhas | Lógica e Python do básico, até você responder |

**Exercícios guiados** vêm de um catálogo local (10 tecnologias, 3 níveis): você resolve no seu editor, clica em
**Resolver no chat** e o Gyde corrige sem entregar a resposta; depois, **Entregar solução** (só conta com a solução
colada; não há teste automático, e a tela diz isso).

**Projetos guiados** (um por tecnologia): objetivo, pré-requisitos, resultado esperado, arquivos iniciais para baixar,
etapas com tarefas e dica, e próximos desafios. Em cada etapa você cola o arquivo e o Gyde **confere critérios
objetivos** do código (a função existe, o erro é tratado, a consulta usa JOIN, a imagem tem `alt`...). É uma
conferência da estrutura, não uma execução, e a tela diz isso. A etapa só conta, e só dá XP, quando passa em todos os
critérios; a explicação da solução aparece no fim. A solução de referência fica só no servidor. Quem nunca programou não recebe exercício avançado, e quem já é avançado não precisa
refazer o básico. Quando tudo do plano acaba, aparece um novo desafio em vez de uma tela vazia. Refazer o questionário
atualiza o plano sem apagar XP, exercícios feitos nem a sequência de dias.

<p align="center"><img src="docs/imagens/pratica.jpg" alt="Tela de Prática com trilhas e projetos" width="88%"></p>

### Forja, o agente de código
O chat do Gyde com acesso a uma pasta do seu computador. A conversa funciona como no chat principal. A diferença
é que a Forja **trabalha nos arquivos de verdade**: lê o código, cria e edita arquivos, roda os testes até passarem
e documenta. Você não precisa saber comandos de terminal.

1. Abra a Forja e escreva o pedido (ou clique em **Conectar pasta do projeto**). A janela do Windows abre para você
   escolher a pasta (no app de desktop, a janela nativa); o servidor do Gyde, que roda no mesmo PC, passa a ter acesso só a ela.
2. A Forja identifica o projeto (tecnologias, quantidade de arquivos, comando de testes) e mostra isso no topo.
3. Cada ação aparece ao vivo (lendo, editando, executando), com o tempo que levou e as mudanças coloridas.
4. No fim vem um resumo, montado pelo servidor e não pelo texto da IA, com os arquivos **criados, alterados e
   apagados** e os **comandos rodados** com o resultado.
5. Continue a conversa: o contexto do projeto e das mensagens anteriores fica guardado.

- **Desfazer:** o botão **Desfazer** (ou pedir "desfaça a última alteração") volta os arquivos ao que eram antes da
  última tarefa. Arquivos que você editou depois ficam como estão, e a Forja avisa quais.
- **Trocar de projeto:** o nome da pasta no topo abre o menu com outra pasta e os projetos recentes.
- **Pasta guardada:** a conversa lembra a pasta mesmo depois de fechar o Gyde ou reiniciar o PC. Se a pasta sumir, a
  Forja diz o motivo real (movida ou apagada, unidade desconectada, sem permissão) e o botão **Reconectar pasta**
  aponta a conversa para o novo lugar, mantendo o histórico.
- **Anexos:** prints de erro, referências de layout ou arquivos de texto (clipe, Ctrl+V ou arrastar).
  As imagens vão para um modelo que enxerga.
- **Arquivos do projeto:** o botão de pasta no topo mostra tudo o que a Forja pode ver.

<p align="center"><img src="docs/imagens/forja.jpg" alt="Forja corrigindo um projeto e rodando os testes" width="88%"></p>

**Segurança da Forja** (no código, não só nas instruções da IA):
- só mexe dentro da pasta escolhida, nem por `..`, caminho absoluto ou atalho que aponte para fora;
- nunca lê, envia ao modelo, edita ou apaga arquivos de senhas e chaves (`.env`, chaves SSH, `.pem`, `credentials`...);
- chaves e tokens que aparecerem em arquivos ou saídas viram `[segredo removido]` antes de ir para a IA e para a tela;
- os comandos não recebem as chaves do Gyde;
- comandos são classificados: os perigosos (formatar, desligar, mexer no sistema, ler senhas) são **bloqueados**;
  apagar arquivos, instalar pacotes, acessar a internet, mexer no Git remoto ou publicar **pedem a sua autorização**;
- botão **Parar** a qualquer momento (também encerra os comandos em andamento);
- a cópia dos arquivos usada pelo **Desfazer** fica só no banco local e nunca vai para a IA.

### Configurações
No menu lateral, **Configurações** reúne tudo em seções: **Geral** (tema automático, claro ou escuro; página inicial;
vídeo de abertura; restaurar padrões; copiar um relatório de erro), **IA e modelos** (chave do FreeLLMAPI, geração de
imagens, estado real da conexão, modo online, offline ou automático, como o Gyde deve responder, memória), **Uso e
limites**, **Prática** (suas respostas, nível medido e desempenho; refazer o questionário), **Privacidade e dados** (o
que fica no PC, o que vai para a IA, cópia de segurança para baixar e restaurar, apagar conversas e registros) e
**Extensões** (tokens). Cada opção salva na hora.

<p align="center"><img src="docs/imagens/dados.jpg" alt="Configurações, aba Privacidade e dados, com a cópia de segurança" width="88%"></p>

### E mais
- **Skills:** habilidades instaláveis, como plugins (`/revisar`, `/git`, `/sql`...). Dá para criar as suas e publicar na loja de skills.
- **Questionário inicial:** o Gyde descobre o seu nível e objetivo e adapta as explicações e a Prática.
- **Turmas:** o professor cria a turma, passa exercícios com prazo e acompanha quem fez.
- **Memória:** o Gyde lembra o que você pedir para ele lembrar (dá para ver e apagar).
- **Revisar projeto inteiro:** anexe uma pasta ou um `.zip` e peça a revisão.
- **Imagens e voz:** gera imagens (Cloudflare, ligado em Configurações > IA) e lê as respostas em voz alta com a voz do Windows.
- **App de desktop:** janela própria (Electron), uma instância só, seletor de pasta nativo, registro de diagnóstico e atualização pelo GitHub. Tema claro e escuro.
- **Vídeo de abertura** em 3D, com narração e legendas.

## Extensões

### VS Code
O Gyde dentro do editor: chat na barra lateral e, com o botão direito, **Explicar com o Gyde**,
**Revisar com o Gyde** e **Explicar o erro desta linha**. A resposta tem o botão **Inserir no editor**.
Veja [pacotes/extensao-vscode](pacotes/extensao-vscode/README.md).

<p align="center"><img src="docs/imagens/vscode.jpg" alt="Extensão do Gyde no VS Code" width="88%"></p>

### Chrome
Painel lateral que lê a página, a seleção ou um print, e um **modo agente**: você dá o comando e ele faz sozinho
na aba, com uma seta que clica e digita (e para antes de compras, exclusões e senhas).
Veja [pacotes/extensao-chrome](pacotes/extensao-chrome/LEIA-ME.md).

## Como funciona

```mermaid
flowchart LR
    V["Você"] --> N["App de desktop ou navegador<br/>(chat, Prática, Forja)"]
    VS["VS Code / Chrome"] --> G
    N --> G["Gyde<br/>(no seu computador)"]
    G --> F["FreeLLMAPI<br/>(no seu computador)"]
    F --> M["Modelos grátis<br/>Google, Groq, Mistral..."]
    G --> D[("Seus dados<br/>só no seu PC")]
```

O Gyde tenta uma fila de modelos bons para programar. Se um estiver ocupado ou fora do ar, o próximo assume.
Cada resposta mostra, embaixo, o **modelo que respondeu de verdade** (os nomes do FreeLLMAPI são apelidos: o
"claude-sonnet-4-5" de lá, por exemplo, foi atendido pelo Qwen nos testes) e os tokens usados.

**Por dentro:** tudo em TypeScript estrito. O servidor é Node.js com Express e o SQLite que já vem no Node, com o
esquema do banco em migrações numeradas (cópia do banco antes de cada atualização). A interface é Svelte 5 com Vite.
Servidor e interface conferem cada resposta pelos mesmos contratos (Zod), então uma tela nunca recebe um formato que
não espera sem avisar. O app de desktop é Electron: sobe o servidor num processo separado e abre a interface.

## Avaliação da IA

A ordem dos modelos e as proteções da Forja foram escolhidas com chamadas reais, corrigidas automaticamente (código
rodando contra testes, arquivos conferidos no disco). Resumo e dados brutos em [docs/avaliacao](docs/avaliacao/README.md):
no chat, `qwen3.8-27b` e `gpt-oss-120b` acertaram as 5 tarefas em menos de 1 s; na Forja, a versão atual completou
11 de 12 cenários (corrigir bug sem mexer no teste, preservar mudança não salva no git, mudar API e tela juntas,
responder sem mexer em nada). Amostras pequenas: servem para comparar, não como garantia.

## Uso, cotas e limites

Em **Configurações > Uso e limites** (ou clicando no indicador do rodapé do chat), cada conceito aparece separado:

| O quê | O que é | De onde vem |
|---|---|---|
| **Uso do Gyde** | Pedidos seus (mensagem do chat, tarefa da Forja, dica da Prática), hoje e nos últimos 7 dias, separados em concluídos, com falha, cancelados e barrados por limite | Registro do próprio Gyde, no banco local (`uso.ts`) |
| **Chamadas** | Quantas vezes o Gyde falou com o provedor. Trocas de modelo e rodadas da Forja geram várias chamadas num pedido, e o pedido conta uma vez só | Registro do Gyde |
| **Tokens** | Entrada e saída do modelo | Campo `usage` da resposta do provedor. Se ele não manda, aparece "não informado", nunca estimado |
| **Cota do provedor** | Pedidos por minuto livres e a hora em que renova; consumo do mês na conta do FreeLLMAPI | Cabeçalhos `x-ratelimit-*` e a rota `/v1/usage` do FreeLLMAPI |
| **Créditos e saldo** | Não existe no FreeLLMAPI | Aparece "Saldo não disponibilizado pelo provedor" |
| **Planos do Gyde** | Não existem: o Gyde não tem assinatura nem cobrança | — |

Provedores diferentes (FreeLLMAPI e modelo local) aparecem separados, porque as cotas não se somam.

<p align="center"><img src="docs/imagens/uso.jpg" alt="Configurações, aba Uso e limites" width="88%"></p>

**Quando o limite acaba**, a mensagem diz qual limite foi (os pedidos por minuto do FreeLLMAPI), quando ele renova
(se o FreeLLMAPI informou) e o que funciona enquanto isso (o modelo local, se estiver instalado). No modo automático,
se o FreeLLMAPI parar de responder, o Gyde usa o modelo local e **avisa** na resposta, sem troca silenciosa.

O FreeLLMAPI não informa a cota diária de cada serviço grátis que ele usa por trás (Google, Groq...), então o Gyde
também não mostra isso.

## IA offline (sem internet)

O Gyde pode usar um modelo que roda no seu computador pelo [Ollama](https://ollama.com), sem mandar nada para fora.

1. Instale o Ollama e baixe um modelo pequeno (o download é seu, de uns 2 GB): `ollama pull qwen2.5:3b`
2. Em **Configurações > IA e modelos**, escolha **Só offline**, ou deixe em **Automático** (usa o offline se o FreeLLMAPI cair).

| Funciona sem internet | Funciona offline depois de instalar o Ollama e baixar um modelo | Precisa de internet |
|---|---|---|
| App, contas, histórico, Prática (editor e testes), rodar código e passo a passo, skills, turmas, memória salva | Chat, Forja, dicas da Prática e títulos de conversa (com o modelo local) | Modelos online (FreeLLMAPI), gerar imagens (Cloudflare), extensão do Chrome no modo agente |

Modelos locais pequenos são bem mais simples e lentos que os online, principalmente em tarefas grandes de programação.
Num computador com 8 GB de RAM e sem placa de vídeo, use modelos de até 3 bilhões de parâmetros.

## Instalar

**Siga o [COMO-INSTALAR.md](COMO-INSTALAR.md)**: o passo a passo completo, feito para quem nunca instalou nada
parecido. Prefere ver? O **[vídeo passo a passo](docs/tutorial/instalar-o-gyde.mp4)** (4 min 51 s, com
narração e [legendas](docs/tutorial/instalar-o-gyde.vtt)) mostra o instalador e o app de verdade, do download à
primeira conversa.

Resumo:

1. Na página **Releases** deste repositório, baixe o **`Gyde-Setup-<versão>.exe`**.
2. Abra e siga as telas: **Apenas para mim** → **Próximo** → **Instalar** → **Concluir**. Não precisa ser
   administrador, nem instalar Node.js ou outra coisa antes.
3. O Gyde abre numa janela própria. Crie a conta (fica só no seu computador) e responda o questionário.
4. Instale o [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi/releases/latest), coloque uma chave grátis
   (ex.: Google AI Studio) e cole a chave dele em **Configurações > IA e modelos**.

O instalador não tem assinatura digital paga, então o Windows pode mostrar o aviso do SmartScreen (**Mais
informações** > **Executar assim mesmo**, se você baixou daqui). Os dados e o `.env` ficam em `%APPDATA%\Gyde`;
atualizar mantém tudo, e desinstalar pergunta antes de apagar os seus dados.

> Cada pessoa tem o próprio Gyde: a conta, as conversas e o progresso ficam no computador de quem instalou,
> e cada um usa as próprias chaves grátis de IA.

## Configuração (.env)

A chave do FreeLLMAPI é colada em **Configurações > IA e modelos**. Se quiser editar à mão, o `.env` fica em
`%APPDATA%\Gyde` no app de desktop (ou na pasta principal, rodando pelo código) e **nunca vai para o GitHub**. Exemplo (sem chaves de verdade):

```ini
# obrigatório para os modelos online
FREELLMAPI_URL=http://127.0.0.1:31415
FREELLMAPI_KEY=cole-aqui-a-chave-do-freellmapi

# opcionais
PORT=3210                      # porta do Gyde
GYDE_MODO_IA=auto              # auto | online | offline
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODELO=qwen2.5:3b
CLOUDFLARE_ACCOUNT_ID=         # gerar imagens (Configurações > IA e modelos)
CLOUDFLARE_API_TOKEN=
```

Pelo código (para quem desenvolve): `npm install`, `npm run build` e `npm start` (Node.js 22.18 ou mais novo).
`npm run desktop` abre o app de desktop a partir do código e `npm run dist:win` gera o instalador em `dist-desktop/`.

### Atualizar o Gyde

O app procura versões novas no GitHub ao abrir e **pergunta** antes de baixar; também dá para instalar o instalador
novo por cima. Contas, conversas e progresso não são tocados. Quando uma versão nova muda o banco, o Gyde guarda uma
cópia dele antes em `copias-banco` (as 5 mais recentes). Pelo código: `git pull`, `npm install`, `npm run build` e
reinicie o servidor (se ele continuar aberto, a tela avisa que está rodando a versão anterior).

## Testes

```bash
npm test          # tipos, ESLint e testes automáticos
npm run build
npm run e2e       # testes de navegador
```

`npm test` confere os tipos (servidor, desktop e interface, com `tsc` e `svelte-check`) e roda os testes automáticos de
`pacotes/servidor/testes` e `pacotes/interface/testes`, sem internet e sem gastar cota:
- **segurança:** caminhos fora da pasta, arquivos de senha, classificação de comandos, remoção de segredos;
- **uso:** pedidos x chamadas, tokens só quando informados, cancelados e limite por minuto (com um provedor falso local);
- **Prática:** mais de 10 mil combinações das alternativas reais do questionário, cada linguagem, níveis, respostas
  inválidas ou faltando, progresso parcial e completo. A regra testada: toda resposta válida vira um plano com próximo
  passo (ou um novo desafio), sem chamar IA;
- **contratos:** as regras dos formatos de resposta e o modo estrito do servidor;
- **migrações:** banco novo, banco antigo com dados, versão mais nova recusada, migração com falha desfeita, cópia;
- **troca de senha do app de desktop:** só com o segredo do app e só no modo pessoal (sobe um servidor temporário);
- **Forja:** o estado das tarefas na tela (eventos, duração, pendências);
- **cópia de segurança, limite de logins e a lógica da interface** (eventos da resposta, valores do Python, cliente da API).

`npm run e2e` roda as suítes de `testes-e2e` num Chrome ou Edge sem janela, cada uma com um servidor próprio e um
FreeLLMAPI falso (sem chave e sem cota): chat, Forja, Prática, Skills, Turmas, entrada, modo público, cópia de
segurança, imagens, relatório de erro, app de desktop e uma auditoria de acessibilidade (WCAG 2.1 AA, temas claro e
escuro, e celular). O CI do GitHub roda tudo isso em Windows, Linux e macOS.

`npm run extensoes` gera o `.vsix` do VS Code e o `.zip` da Chrome Web Store.

## Limitações conhecidas

- Os modelos grátis variam: às vezes um modelo recusa uma tarefa sozinho ou pergunta em vez de agir. O Gyde troca
  de modelo quando a resposta vem vazia ou inválida, mas não dá para garantir o mesmo comportamento sempre.
- O modelo local (Ollama) é bem mais simples e lento que os online, principalmente na Forja.
- O **Desfazer** da Forja guarda as 10 últimas tarefas de cada conversa e não copia arquivos maiores que 2 MB.
- Exercícios guiados não têm correção automática (contam com a solução entregue, e o Gyde corrige no chat). Os
  projetos guiados conferem a estrutura do código por critérios objetivos, mas não executam o programa: um código que
  passa nos critérios ainda pode ter um erro de lógica.
- Os modelos grátis variam de um dia para o outro. A ordem dos modelos foi escolhida por uma avaliação pequena
  (veja "Avaliação da IA"), que serve para comparar, não como garantia.
- A Forja só funciona no modo pessoal (rodando no seu PC), e só roda comandos no Windows: a proteção contra comandos
  perigosos foi feita para o cmd. No Mac e no Linux ela lê e edita os arquivos e diz qual comando rodar.
- O instalador do app de desktop não tem assinatura digital (custa dinheiro), então o Windows mostra o aviso do SmartScreen.
- O envio de e-mail (`configurar-email.bat`, só para o modo público) grava no `.env` da pasta do código, não no app de desktop.
- A moderação depende das instruções do Gyde e do provedor; não há um filtro de conteúdo separado.
- Imagens geradas ficam acessíveis para qualquer conta logada no mesmo Gyde que tenha o link (os nomes são aleatórios).

## Contribuir

Ideias e correções são bem-vindas: veja o [CONTRIBUTING.md](CONTRIBUTING.md) (como rodar, testar e as regras do
projeto). Achou uma falha de segurança? Siga o [SECURITY.md](SECURITY.md). O que mudou em cada versão está no
[CHANGELOG.md](CHANGELOG.md).

## Perguntas frequentes

**É grátis mesmo?**
Sim. O Gyde é grátis e usa os limites grátis dos serviços de IA (Google, Groq, Mistral e outros) pelo FreeLLMAPI.

**Precisa de internet?**
Para os modelos online, sim. Sem internet, dá para usar um modelo local pelo Ollama (veja "IA offline").

**Meus dados vão para algum lugar?**
Sua conta, conversas e progresso ficam na pasta `data` do seu computador (no app de desktop, em `%APPDATA%\Gyde`).
As mensagens vão só para o serviço de IA que responde.

**E quando o limite grátis acabar?**
O FreeLLMAPI troca de serviço quando um deles esgota. Se acabar o limite por minuto do próprio FreeLLMAPI, o Gyde
diz quando renova e, se você tiver o Ollama, oferece o modelo local. Veja em **Configurações > Uso e limites**.

**Funciona no Mac ou no Linux?**
Foi feito no Windows. Os testes automáticos rodam também em Linux e macOS no CI do GitHub, e o app de desktop tem
instaladores configurados para os dois (`npm run dist:mac`, `npm run dist:linux`), ainda sem teste à mão. A Forja
rodando comandos é só do Windows.

## Estrutura do projeto

| Pasta ou arquivo | Para que serve |
|---|---|
| `COMO-INSTALAR.md` | Passo a passo de instalação |
| `ferramentas/` | Para quem cuida do projeto: e-mail (modo público), trocar senha pelo código, extensão do VS Code, avaliações da IA, imagem do instalador e o tutorial em vídeo |
| `pacotes/servidor/` | Servidor: `server.ts` monta os módulos: chat (`chat.ts`), Forja (`codigo-agente.ts`), Prática (`pratica-servidor.ts`), configurações locais e cópia de segurança (`configuracao.ts`, `copia.ts`), perfil (`perfil.ts`), banco e migrações (`banco.ts`, `migracoes.ts`), provedores online/offline (`provedores.ts`), uso (`uso.ts`), proteções (`seguranca.ts`), skills (`skills-catalogo/`) e testes (`testes/`) |
| `pacotes/interface/` | Interface em Svelte 5 + Vite: chat, Forja, Prática, Skills, Turmas, Configurações e entrada (`src/`) |
| `pacotes/compartilhado/` | Contratos (Zod) usados pelo servidor e pela interface |
| `pacotes/desktop/` | App de desktop (Electron). O instalador é gerado com `npm run dist:win` |
| `pacotes/extensao-vscode/`, `pacotes/extensao-chrome/` | Extensões para o VS Code e o Chrome |
| `testes-e2e/` | Testes de navegador (`npm run e2e`) e o teste do instalador (`npm run teste:instalacao`) |
| `docs/` | Imagens desta página, o tutorial em vídeo (`docs/tutorial/`) e as avaliações da IA (`docs/avaliacao/`) |

Arquivos criados no seu computador e que **nunca** vão para o GitHub: `.env` (suas chaves) e `data/` (contas e conversas).

Esqueceu a senha? No app de desktop, use **Esqueci minha senha** na entrada; pelo código, rode `ferramentas\redefinir-senha.bat`.

O Gyde foi feito para rodar no seu próprio computador: o servidor só aceita conexões do próprio PC (127.0.0.1).

## Sobre

**Gyde** (Gustavo + Yasmin + Deschamps, e soa como *guide*, "guia") foi criado por
**Gustavo Moreira Deschamps**, estudante de Desenvolvimento de Sistemas na Escola SESI SENAI Blumenau.

Achou um problema ou tem uma ideia? Abra uma [issue](https://github.com/gustavomdeschamps/Gyde/issues).

Licença [MIT](LICENSE): use, estude, modifique e compartilhe, mantendo os créditos.
