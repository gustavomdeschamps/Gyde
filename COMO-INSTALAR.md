# Como instalar o Gyde (passo a passo)

Guia para quem baixou o Gyde e vai usar pela primeira vez no próprio computador.
Leva uns **15 minutos**. Siga na ordem, sem pular etapas.

> **Antes de começar, entenda uma coisa:** o Gyde que você baixa vem **zerado**.
> As conversas, a conta, a memória, o XP e os projetos de quem criou o Gyde **não vêm junto**. Cada pessoa
> cria a própria conta e usa a própria IA (com as próprias chaves grátis). Veja a tabela no fim deste guia.

---

## Duas formas de usar

- **App de desktop (instalador):** um `Gyde Setup.exe` que instala o Gyde como um programa, com janela própria e
  atalho no menu Iniciar. Não precisa do Node.js nem dos `.bat`. Ainda não há uma versão publicada na página
  **Releases** do GitHub; quando houver, é só baixar e instalar (veja "App de desktop" no fim deste guia).
- **Pelo código (este guia):** baixar o projeto e usar o `instalar.bat` e o `iniciar.bat`. Funciona hoje.

Os passos 2 e 3 (FreeLLMAPI e chaves) valem para as duas formas.

---

## O que você precisa

- Um computador com **Windows 10 ou 11**.
- Internet.
- Uma conta Google (para pegar a chave grátis de IA).

---

## Passo 1 — Baixar o Gyde

1. Na página do Gyde no GitHub, clique no botão verde **Code** e depois em **Download ZIP**.
2. Abra a pasta **Downloads**, clique com o botão direito no arquivo `.zip` e escolha **Extrair tudo...**.
3. Mova a pasta extraída para um lugar fixo, por exemplo `Documentos\Gyde`.
   Não deixe dentro de Downloads, para não apagar sem querer.

Pronto: dentro da pasta você vai ver `instalar.bat`, `iniciar.bat`, este guia e as pastas `pacotes` (o programa) e `configurar` (extras).
Você só vai usar o `instalar.bat` (uma vez) e o `iniciar.bat` (todo dia). A pasta `configurar` tem os extras.

---

## Passo 2 — Instalar o FreeLLMAPI (o "motor" de IA grátis)

O Gyde não tem IA própria rodando no computador: ele usa o **FreeLLMAPI**, um programa grátis que junta
vários serviços de IA gratuitos num lugar só.

1. Abra https://github.com/tashfeenahmed/freellmapi/releases/latest
2. Na lista **Assets**, baixe o instalador do Windows (o arquivo que termina em **`.exe`**).
3. Abra o arquivo baixado e instale (avançar, avançar, concluir).
   Se o Windows mostrar um aviso, confira que o arquivo veio da página acima antes de continuar.
4. Depois de instalado, o FreeLLMAPI fica **perto do relógio**, na bandeja do Windows
   (se não aparecer, clique na setinha `^` ao lado do relógio).
5. Clique no ícone dele e escolha **Open Dashboard**. Vai abrir uma página no navegador
   (o endereço é `http://127.0.0.1:31415`).

---

## Passo 3 — Pegar chaves grátis de IA e colocar no FreeLLMAPI

O FreeLLMAPI precisa de **pelo menos uma chave** de um serviço de IA. Todas abaixo são grátis.
**Quanto mais chaves você colocar, melhor e mais rápido o Gyde fica**, porque ele troca sozinho de modelo
quando um está ocupado. Comece pela do Google (obrigatória neste guia) e, se puder, faça mais duas ou três.

### 3.1 Google AI Studio (obrigatória)

1. Abra https://aistudio.google.com/apikey e entre com sua conta Google.
2. Clique em **Create API key** (Criar chave de API).
3. Clique no botão de copiar ao lado da chave criada (ela começa com `AIza`).
4. No **Dashboard do FreeLLMAPI**, abra a página **Keys**, escolha **Google**, cole a chave e salve.

### 3.2 Recomendadas (deixam o Gyde melhor para programar)

Faça igual: crie a chave no site, copie e cole na página **Keys** do FreeLLMAPI, escolhendo o serviço certo.

| Serviço | Onde criar a chave | Por que vale a pena |
|---|---|---|
| Groq | https://console.groq.com/keys | Muito rápido; modelos grandes de código aberto |
| Mistral | https://console.mistral.ai/api-keys | Tem o Codestral, feito para programação |
| Cerebras | https://cloud.cerebras.ai | Muito rápido |
| OpenRouter | https://openrouter.ai/keys | Muitos modelos grátis num lugar só |

A lista completa de serviços que o FreeLLMAPI aceita está na própria página **Keys** e em
https://freellmapi.co/models.html.

> **Segurança:** essas chaves são suas. Não mande para ninguém e não poste em lugar nenhum.

---

## Passo 4 — Rodar o instalador do Gyde

**Deixe o FreeLLMAPI aberto** e dê dois cliques em **`instalar.bat`** (na pasta do Gyde).
Vai abrir uma janela preta que faz 5 coisas. Ela vai pedindo o que precisa:

1. **Node.js** — o Gyde precisa do Node.js 22.18 ou mais novo.
   Se não tiver, o instalador pergunta se pode instalar: digite `s` e Enter.
   Quando terminar, **feche a janela e abra o `instalar.bat` de novo**.
2. **Dependências** — baixa o que o Gyde usa. Só esperar.
3. **FreeLLMAPI** — confere se ele está aberto. Se disser que não está, abra o FreeLLMAPI e aperte Enter.
4. **Chave do FreeLLMAPI** — o instalador pede a "chave unificada":
   1. Clique no ícone do FreeLLMAPI perto do relógio.
   2. Clique em **Copy Key** (copiar chave).
   3. Volte para a janela preta e aperte **Enter**.
   A chave é lida da área de transferência e salva no arquivo `.env` (ela não aparece na tela).
   Se pular este passo, dá para colar a chave depois no próprio Gyde, em **Configurações > IA e modelos**.
5. **Atalho** — cria o atalho **Gyde** na Área de Trabalho.

No fim aparece **"Tudo pronto!"**. Digite `s` e Enter para abrir o Gyde.

---

## Passo 5 — Primeira vez no Gyde

1. O navegador abre em http://127.0.0.1:3210 e passa o **vídeo de abertura** (aperte **Esc** se quiser pular).
2. Clique em **Criar conta**. Use qualquer e-mail e uma senha.
   A conta é **só sua e só neste computador**: nada é enviado para a internet e não precisa confirmar e-mail.
3. Responda o **quiz de boas-vindas** (ou pule). Ele serve para o Gyde explicar no seu nível.
4. Pronto! Mande sua primeira pergunta no chat.

---

## Como usar no dia a dia

1. Abra o **FreeLLMAPI** (se ele não abrir sozinho com o Windows).
2. Dê dois cliques no atalho **Gyde** da Área de Trabalho.
3. **Deixe a janela preta aberta** enquanto usa. Fechou a janela, o Gyde desliga.

---

## Extras (opcionais)

| O quê | Como |
|---|---|
| **Forja** (agente que mexe no seu projeto) | No menu **Forja**, clique em **Abrir pasta do projeto**, escolha a pasta e converse. Ela escreve, testa e documenta sozinha, e mostra quanto tempo levou. |
| Gerar imagens | Na pasta `configurar`, rode `configurar-imagens.bat` |
| Voz mais natural | Na pasta `configurar`, rode `configurar-voz.bat` (usa a mesma chave do Google AI Studio) |
| Extensão do Chrome | Siga o `LEIA-ME.md` da pasta `pacotes\extensao-chrome` |
| Extensão do VS Code | Na pasta `configurar`, rode `instalar-vscode.bat` |
| Instalar como app | No Gyde, botão **Instalar o Gyde como app** na barra lateral |
| IA sem internet | Instale o [Ollama](https://ollama.com), rode `ollama pull qwen2.5:3b` e escolha **Só offline** em **Configurações > IA e modelos** |

---

## O que vem junto e o que NÃO vem

Tudo o que é **pessoal** fica na pasta `data/` e no arquivo `.env` de cada computador (no app de desktop, em `%APPDATA%\Gyde`).
Essas duas coisas **nunca** vão junto quando o Gyde é compartilhado.

| Vem junto (igual para todo mundo) | NÃO vem (cada pessoa começa do zero) |
|---|---|
| O app inteiro, o chat e a Forja | Sua conta e senha |
| Trilhas, exercícios e projetos da Prática | Suas conversas |
| Catálogo de skills | O que o Gyde lembra de você (memória) |
| Vídeo de abertura | XP, sequência de dias e ranking |
| Extensões do Chrome e do VS Code | Turmas e projetos da Forja |
| | As chaves de IA (cada um usa as suas) |

---

## Deu problema? Resolva aqui

| O que aparece | O que fazer |
|---|---|
| "O FreeLLMAPI não está respondendo" | Abra o FreeLLMAPI (ícone perto do relógio) e recarregue a página do Gyde (F5). |
| "A chave do FreeLLMAPI ainda não foi configurada" | No ícone do FreeLLMAPI clique em **Copy Key** e cole em **Configurações > IA e modelos** (o aviso tem um atalho para lá). |
| Respostas com erro ou muito lentas | Coloque mais chaves no FreeLLMAPI (Passo 3.2). Os serviços grátis têm limite por minuto. |
| "Node.js é antigo demais" | Rode o `instalar.bat` e aceite instalar o Node.js; depois feche e abra de novo. |
| A página não abre | Confira se a janela preta do Gyde está aberta. Abra http://127.0.0.1:3210 à mão. |
| A porta 3210 já está em uso | Abra o arquivo `.env` com o Bloco de Notas e adicione a linha `PORT=3211`. Depois use http://127.0.0.1:3211 |
| Esqueci minha senha | No app de desktop: **Esqueci minha senha** na tela de entrada (o Windows pede para confirmar). Pelo código: na pasta `configurar`, rode `redefinir-senha.bat`. |
| A Forja não abre a janela de pastas | A Forja só funciona com o Gyde rodando no seu próprio computador (Windows). |
| "O Gyde foi atualizado, mas o servidor ainda está rodando a versão anterior" | Feche a janela preta do Gyde e abra o `iniciar.bat` de novo. Isso aparece depois de baixar uma versão nova com o Gyde aberto. |
| O Windows diz que o instalador "pode danificar o computador" (SmartScreen) | O instalador do Gyde não tem assinatura digital paga. Se você baixou da página Releases do repositório oficial, clique em **Mais informações** e **Executar assim mesmo**. |
| A Forja diz que a pasta não foi encontrada | A pasta mudou de lugar ou foi renomeada. Clique em **Reconectar pasta** e escolha o novo lugar: o histórico da conversa continua. |

---

## App de desktop

Quando houver uma versão publicada em **Releases**:

1. Baixe o `Gyde Setup x.y.z.exe` e abra. Escolha a pasta (ou deixe a sugerida) e conclua.
2. Abra o **Gyde** pelo atalho. Ele sobe o servidor sozinho, numa janela própria, e fecha tudo junto quando você fecha a janela.
3. Crie a conta e cole a chave do FreeLLMAPI em **Configurações > IA e modelos**.

Seus dados e o `.env` ficam em `%APPDATA%\Gyde` (não na pasta do programa), então reinstalar ou atualizar não apaga nada.
O app procura versões novas no GitHub ao abrir e pergunta antes de baixar.

Para gerar o instalador a partir do código: `npm install` e depois `npm run dist:win` (sai em `dist-desktop/`).
