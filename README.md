# Gyde

**Gyde** (Gustavo + Yasmin + Deschamps — e soa como *guide*, "guia") é um tutor de programação com IA,
em português, para quem está aprendendo. Roda no seu computador usando os modelos grátis do
[FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi).

## Instalar (Windows)

**Primeira vez? Siga o [COMO-INSTALAR.md](COMO-INSTALAR.md)**: passo a passo completo, com as chaves grátis de IA,
o que vem junto e o que não vem (cada pessoa começa com a própria conta e a própria IA) e solução de problemas.

Resumo:

1. Baixe ou clone este repositório.
2. Dê dois cliques em **`instalar.bat`**. Ele confere o Node.js, instala as dependências, ajuda a abrir o
   [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi), salva a chave e cria um atalho **Gyde** na Área de Trabalho.
3. Abra pelo atalho (ou `iniciar.bat`) com o FreeLLMAPI aberto. O Gyde roda em http://127.0.0.1:3210.

Extras opcionais ficam na pasta **`configurar`**: `configurar-imagens.bat` (gerar imagens), `configurar-voz.bat` (voz natural
com o Gemini) e `instalar-vscode.bat` (extensão do VS Code). A extensão do Chrome está em `extensoes\chrome` (veja o
`LEIA-ME.md` de lá). No Chrome/Edge dá para **instalar o Gyde como app** (botão na barra lateral).

## Modo pessoal e modo público

- **Pessoal (padrão):** para usar no seu computador. Crie a conta com qualquer e-mail — nada é enviado e não há
  código para confirmar. Esqueceu a senha? Rode `configurar\redefinir-senha.bat`.
- **Público:** para hospedar para outras pessoas. Coloque `GYDE_MODE=publico` no `.env` e configure o e-mail
  (`configurar\configurar-email.bat`): as contas passam a ser confirmadas por código.

## O que ele faz

- **Conta própria:** cadastro (no modo público, com código de confirmação por e-mail), login, troca de senha. Cada pessoa vê só o que é dela.
- **Quiz de boas-vindas:** perguntas sobre a pessoa + 8 desafios de código na linguagem que ela escolher
  (Python, JavaScript ou Java). O Gyde adapta as explicações ao nível, às linguagens e aos pontos fracos.
- **Skills:** habilidades instaláveis, como plugins. Cada skill é um arquivo `.md` com instruções; ela entra em ação
  pelo comando (`/revisar`, `/git`, `/sql`...) ou sozinha pelas palavras-gatilho. Dá para criar as suas, exportar e importar.
  O catálogo fica em `app/skills-catalogo/`: coloque um `.md` lá e ele aparece para instalar.
- **Loja de skills:** publique uma skill sua e quem usa o mesmo Gyde instala uma cópia (com contador de instalações).
- **Rodar código no chat:** botão **Executar** nos blocos de Python e JavaScript, e **Passo a passo**, que mostra
  linha por linha o valor de cada variável.
- **Prática:** trilhas, exercícios e **projetos guiados** com editor, testes automáticos, XP e Dica do Gyde. Tem
  **desafio do dia**, **sequência de dias**, **ranking com amigos** e **revisão dos erros** (o exercício que você errou
  volta depois de 1, 3, 7 e 21 dias).
- **Turmas:** o professor cria a turma, passa exercícios da Prática com prazo e vê quem fez cada um; os alunos
  entram com um código de 6 letras.
- **Revisar projeto inteiro:** anexe uma pasta ou um .zip (sem `node_modules`, `.env` e afins) e peça a revisão.
- **Memória:** o Gyde lembra fatos sobre você entre conversas ("lembre que..."). Dá para ver, apagar e desligar em Personalizar.
- **Forja, o agente de código** (menu "Forja", só no modo pessoal): como o Codex ou o Claude Code. Clique em
  **Abrir pasta do projeto**, escolha a pasta no Explorador de Arquivos e converse num chat ligado a ela. A Forja
  trabalha sozinha como um desenvolvedor (escreve, testa, corrige e documenta), faz várias ações por rodada para
  responder rápido e mostra quanto tempo levou. Lembra da conversa daquele projeto. Cada passo aparece num bloco que
  abre e fecha, com as mudanças coloridas, e o botão de enviar vira **Parar** enquanto ela trabalha. Segurança: só mexe
  dentro da pasta escolhida, não lê `.env` nem chaves, recusa a raiz do disco e pastas como Documentos e Área de
  Trabalho inteiras, bloqueia comandos perigosos (formatar, desligar, apagar o disco...) e para em 30 rodadas (cada rodada pode ter várias ações).
- **Extensão para Chrome** (pasta `extensoes/chrome/`): painel lateral que lê a página, a seleção ou um print, e um
  **modo agente**: você dá o comando e ele faz sozinho na aba, com uma seta animada que clica e digita (para só em
  compras, exclusões, senhas e cartões).
- **Extensão para VS Code** (pasta `extensoes/vscode/`): chat na barra lateral, explicar seleção, revisar arquivo e
  explicar o erro da linha.
- **App (PWA):** instale pelo navegador; a casca funciona sem internet.
- **Chat de tutor:** explica o erro, mostra onde está, diz o porquê e só depois corrige. Streaming, histórico com busca,
  fixar, renomear, exportar, editar pergunta, gerar de novo, anexar imagens/PDFs/código.
- **Modelos:** Gyde 1 e Gyde 1 Pro combinam os melhores modelos para programar do FreeLLMAPI (Claude, Qwen, GPT-OSS,
  Codestral). Se um falhar, o próximo da fila assume sozinho. As filas ficam em `app/motor.js`.
- **Imagens** (botão "Imagem") e **voz** (ditado com "enviar" no fim; ouvir respostas).
- **Vídeo de abertura** em 3D com narração, trilha original e legendas sobrepostas. Termina com a logo voando até o
  lugar dela na tela de entrada (ou no app), enquanto a tela real aparece por trás. Esc pula; o botão no canto liga e
  desliga o som. O vídeo é gerado no estúdio em `C:\tools\gyde-video` (fora deste projeto).
- Tema claro/escuro, animações (respeita "reduzir movimento" do sistema) e layout para celular.

## E-mail (Gmail) — só no modo público

O `configurar\configurar-email.bat` pede o seu Gmail e uma **senha de app** do Google:

1. Ative a **verificação em duas etapas** na sua conta Google (é exigência do Google para senhas de app).
2. Abra https://myaccount.google.com/apppasswords, crie uma senha com o nome "Gyde" e copie.
3. Rode o `configurar-email.bat`. Ele manda um e-mail de teste para você antes de salvar.

Para publicar o Gyde na internet com HTTPS, adicione `COOKIE_SECURE=1` no `.env`.

## Estrutura

Na pasta principal ficam só o que a pessoa usa: `instalar.bat`, `iniciar.bat` e os guias.

| Pasta ou arquivo | Para que serve |
|---|---|
| `instalar.bat` | Instala tudo na primeira vez (roda uma vez só) |
| `iniciar.bat` | Abre o Gyde no dia a dia |
| `COMO-INSTALAR.md` | Passo a passo para quem baixou o Gyde |
| `configurar/` | Extras opcionais: chave do FreeLLMAPI, imagens, voz, e-mail, trocar senha, extensão do VS Code (os scripts de verdade ficam em `configurar/scripts/`) |
| `extensoes/` | Extensões do Gyde para o Chrome (`chrome/`) e o VS Code (`vscode/`) |
| `app/` | O programa (a pessoa não precisa mexer) |
| `.env` | Chaves e senhas, criado na instalação. **Não compartilhe este arquivo.** |
| `data/` | Banco de dados com contas, conversas e progresso, criado no primeiro uso |

Dentro de `app/`:

| Arquivo | Para que serve |
|---|---|
| `server.js` | Servidor: conversas, imagens e conexão com o FreeLLMAPI |
| `motor.js` | Combina os modelos (fila com troca automática quando um falha) |
| `auth.js` | Cadastro, login, sessões e e-mails |
| `quiz.js` | Perguntas e correção do quiz de boas-vindas |
| `skills-sistema.js` e `skills-catalogo/` | Skills instaláveis e o catálogo (uma skill por arquivo `.md`) |
| `pratica-dados.js` e `pratica-servidor.js` | Prática: trilhas, exercícios, projetos, XP, desafio do dia e revisão |
| `memoria.js` | Memória entre conversas |
| `turmas.js` | Modo turma (professor e alunos) |
| `codigo-agente.js` e `escolher-pasta.ps1` | Forja (agente de código) e a janela de escolher pasta |
| `agente.js` | Decide os passos do modo agente da extensão do Chrome |
| `public/` | Interface (HTML, CSS, JavaScript), vídeo de abertura e os executores de código |
