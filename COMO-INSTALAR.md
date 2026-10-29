# Como instalar o Gyde (passo a passo)

Guia para quem vai usar o Gyde pela primeira vez no próprio computador. Não precisa saber programar para instalar:
é um instalador comum, como o de qualquer programa. Leva uns **10 minutos**, contando a parte da IA.

> O Gyde que você instala vem **zerado**: a conta, as conversas e o progresso são seus e ficam só no seu computador.
> Cada pessoa usa a própria IA, com chaves grátis (passo 4).

---

## O que você precisa

- **Windows 10 ou 11** (64 bits).
- Uns **500 MB livres** no disco (o programa usa cerca de 350 MB).
- **Não precisa** ser administrador do computador: o Gyde instala só para o seu usuário.
- **Internet** para a IA online. Sem internet, o Gyde abre e a Prática funciona; para conversar sem internet, veja
  "IA sem internet" no fim.

---

## Passo 1 — Baixar o instalador

1. Abra a página do Gyde no GitHub: https://github.com/gustavomdeschamps/Gyde
2. À direita, em **Releases**, clique na versão mais nova.
3. Em **Assets**, baixe o arquivo **`Gyde-Setup-<versão>.exe`** (por exemplo, `Gyde-Setup-2.0.0.exe`).

Os outros arquivos da lista **não** são para você: `latest.yml` e `.blockmap` servem para as atualizações
automáticas, e **Source code** é o código do projeto.

## Passo 2 — Instalar

1. Abra o arquivo baixado (dois cliques, ou clique nele na barra de downloads do navegador).
2. **Se o Windows mostrar "O Windows protegeu o computador"**: isso acontece porque o instalador do Gyde não tem
   uma assinatura digital paga. Se você baixou da página **Releases** do repositório oficial (passo 1), clique em
   **Mais informações** e depois em **Executar assim mesmo**.
3. Na tela **Escolha uma opção de instalação**, deixe marcado **Apenas para mim** e clique em **Próximo**.
   (A outra opção instala para todos os usuários e pede senha de administrador.)
4. Na tela **Escolha o Local da Instalação**, deixe a pasta sugerida e clique em **Instalar**.
5. Espere a barra terminar (alguns segundos).
6. Na tela **Completando a instalação do Gyde**, deixe marcado **Executar o Gyde** e clique em **Concluir**.

O instalador cria o atalho **Gyde** no menu Iniciar e na Área de Trabalho.

## Passo 3 — Abrir o Gyde e criar a conta

1. O Gyde abre numa janela própria (na primeira vez, passa um vídeo de abertura; aperte **Esc** para pular).
   Nos outros dias, abra pelo **menu Iniciar** (digite "Gyde") ou pelo atalho da Área de Trabalho.
2. Clique em **Criar conta**, escolha como quer ser chamado, um e-mail e uma senha.
   A conta é **só sua e só neste computador**: nada é enviado e não precisa confirmar e-mail.
3. Responda o **questionário** (uns 3 minutos) ou pule. Ele diz ao Gyde as linguagens que você quer aprender, o
   seu objetivo e o seu nível, e monta o seu plano na **Prática**.

## Passo 4 — Ligar a IA (uma vez só)

O Gyde não tem IA própria: ele usa o **FreeLLMAPI**, um programa grátis que junta vários serviços de IA gratuitos.

1. Abra https://github.com/tashfeenahmed/freellmapi/releases/latest, baixe o instalador do Windows (o arquivo
   que termina em **`.exe`**) e instale.
2. O FreeLLMAPI fica **perto do relógio** do Windows (se não aparecer, clique na setinha `^`). Clique nele e
   escolha **Open Dashboard**.
3. Pegue uma chave grátis do Google: abra https://aistudio.google.com/apikey, entre com sua conta Google, clique em
   **Create API key** e copie a chave.
4. No Dashboard do FreeLLMAPI, abra **Keys**, escolha **Google**, cole a chave e salve.
   Quanto mais chaves de serviços diferentes você colocar (Groq, Mistral, Cerebras, OpenRouter), melhor: quando um
   serviço está ocupado, o FreeLLMAPI usa outro.
5. No ícone do FreeLLMAPI perto do relógio, clique em **Copy Key** (copiar chave).
6. No Gyde, abra **Configurações** (canto de baixo, à esquerda) > **IA e modelos**, cole a chave e salve.

> As chaves são suas. Não mande para ninguém e não poste em lugar nenhum. O Gyde guarda a chave só neste
> computador e nunca mostra ela de volta na tela.

## Passo 5 — Usar

- **Conversar:** escreva a pergunta na caixa de baixo e aperte Enter. Embaixo de cada resposta aparece o modelo
  que respondeu de verdade.
- **Prática:** no menu **Prática** está o seu plano, com exercícios com testes automáticos (Python e JavaScript),
  exercícios guiados e projetos guiados de todas as linguagens do questionário. Para mudar o plano, refaça o
  questionário: o progresso continua.
- **Forja** (opcional): o agente que trabalha num projeto seu. No menu **Forja**, clique em **Abrir pasta do
  projeto**, escolha a pasta e diga o que quer. Ela lê, edita, roda os testes e mostra o que mudou; apagar arquivos,
  instalar pacotes e acessar a internet sempre pedem a sua confirmação, e **Desfazer** volta o que ela mudou.

---

## Atualizar

O Gyde procura versões novas ao abrir e **pergunta** antes de baixar. Também dá para baixar o instalador novo
(passo 1) e instalar por cima. **Atualizar não apaga nada**: a conta, as conversas e o progresso continuam.

## Desinstalar

Em **Configurações do Windows > Aplicativos > Aplicativos instalados**, procure **Gyde** e clique em
**Desinstalar**. O desinstalador pergunta se você quer apagar também os seus dados (conta, conversas, progresso e a
chave da IA). Se responder **Não**, eles ficam no computador e voltam quando você instalar de novo.

## Onde ficam os seus dados

Em `%APPDATA%\Gyde` (cole isso na barra de endereço do Explorador de Arquivos). Para levar para outro computador,
use **Configurações > Privacidade e dados > Baixar cópia de segurança** e restaure no outro Gyde.

---

## Deu problema? Resolva aqui

| O que aparece | O que fazer |
|---|---|
| "O Windows protegeu o computador" ao abrir o instalador | O instalador não tem assinatura digital paga. Se veio da página **Releases** oficial, clique em **Mais informações** > **Executar assim mesmo**. |
| "A chave do FreeLLMAPI ainda não foi configurada" | Passo 4, itens 5 e 6: **Copy Key** no FreeLLMAPI e cole em **Configurações > IA e modelos** (o aviso tem um atalho para lá). |
| "Não consegui falar com o FreeLLMAPI" | O FreeLLMAPI está fechado. Abra ele (procure no menu Iniciar) e tente de novo. |
| Respostas com erro ou muito lentas | Os serviços grátis têm limite por minuto. Coloque mais chaves no FreeLLMAPI (passo 4, item 4). Em **Configurações > Uso e limites** dá para ver quando o limite renova. |
| O Gyde não abre ou fecha sozinho | Aparece uma janela com **Tentar de novo** e **Abrir o registro**. Se continuar, abra **Configurações > Geral > Registros do app** e mande o arquivo `gyde.log` junto com a descrição do problema (ele não tem chaves). |
| Abrir o Gyde de novo não abre outra janela | É de propósito: só existe um Gyde aberto por vez. A janela que já estava aberta vem para a frente. |
| Esqueci minha senha | Na tela de entrada, **Esqueci minha senha**. O Windows pede para confirmar que é você. |
| A Forja diz que a pasta não foi encontrada | A pasta mudou de lugar, foi renomeada ou está num pendrive desconectado. Conecte de novo, ou clique em **Reconectar pasta** e escolha o novo lugar: a conversa continua. |
| Eu usava o Gyde pelo navegador (atalho antigo do Edge) | Instale este app e, dentro dele, na tela de entrada, use **Trazer seus dados** para importar a conta antiga. Depois remova o atalho antigo em `edge://apps`. |

## IA sem internet

Instale o [Ollama](https://ollama.com), abra o Prompt de Comando e rode `ollama pull qwen2.5:3b` (um download de uns
2 GB). Depois, em **Configurações > IA e modelos**, escolha **Só offline** (ou deixe em **Automático**: ele usa o
modelo local quando o FreeLLMAPI não responde). O modelo local é mais simples e mais lento que os online.

## Extras

| O quê | Como |
|---|---|
| Gerar imagens | **Configurações > IA e modelos**: cole o Account ID e um API Token da Cloudflare (grátis, com cota diária) |
| Extensão do VS Code e do Chrome | Veja o README de cada uma em `pacotes/extensao-vscode` e `pacotes/extensao-chrome` (o app do Gyde precisa estar aberto) |
| Usar pelo código (para quem desenvolve) | Veja **CONTRIBUTING.md**: `npm install`, `npm run build` e `npm start` |
