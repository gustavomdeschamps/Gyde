# Tutorial em vídeo: instalar e começar a usar o Gyde

Roteiro técnico do vídeo `instalar-o-gyde.mp4` (1920x1080, narração em português do Brasil, legendas embutidas e em
arquivo `.vtt`). Todas as telas são **capturas reais** do instalador `Gyde-Setup-2.0.0.exe` e do Gyde instalado,
feitas pelos roteiros de `ferramentas/tutorial/` (nada é montado à mão). Os quadros só com texto (onde baixar,
requisitos, arquivos da página de download, aviso do SmartScreen) são cartões de texto, e o vídeo não os apresenta
como captura. A página Releases do GitHub ainda não tinha nenhuma versão publicada quando o vídeo foi feito; quando a
versão for publicada, vale trocar os cartões dos passos 2 e 3 por uma captura dela.

Como refazer tudo: veja "Produção" no fim.

| # | Cena | Tempo aprox. | Captura real | Destaque |
|---|---|---|---|---|
| 0 | Abertura | 6 s | logo do Gyde | — |
| 1 | O que é o Gyde | 25 s | `passo-09-conversa`, `passo-10-pratica`, `passo-11-forja-resultado` | zoom lento em cada tela |
| 2 | Onde baixar | 16 s | cartão de texto com o endereço e o caminho até Releases | **Releases** |
| 3 | O arquivo certo | 16 s | cartão de texto com os nomes dos arquivos | o `.exe` em destaque |
| 4 | Requisitos | 14 s | cartão de texto | — |
| 5 | Começar a instalação | 30 s | cartão do SmartScreen, `instalador-1-para-quem` | **Apenas para mim**, **Próximo** |
| 6 | Concluir | 22 s | `instalador-2-pasta`, `instalador-3-instalando`, `instalador-4-concluido` | **Instalar**, **Executar o Gyde**, **Concluir** |
| 7 | Abrir o Gyde | 16 s | `app-1-abrindo`, `app-2-primeira-tela` | — |
| 8 | Configuração inicial | 42 s | `passo-08-criar-conta`, `passo-08-questionario`, `passo-08-ia-e-modelos` | botão **Criar conta**, campo da chave |
| 9 | Primeira conversa | 16 s | `passo-09-inicio`, `passo-09-conversa` | caixa de mensagem, modelo que respondeu |
| 10 | Prática e questionário | 26 s | `passo-10-pratica`, `passo-10-projeto` | **Seu plano**, etapas do projeto |
| 11 | Forja (opcional) | 26 s | `passo-11-forja-vazia`, `passo-11-forja-resultado` | **Abrir pasta do projeto**, resumo |
| 12 | Problemas comuns | 24 s | `passo-12-sem-freellmapi` | o aviso no topo |
| 13 | Atualizações e suporte | 16 s | cartão de texto com os endereços | — |
| 14 | Encerramento | 5 s | logo do Gyde | — |

Transições: corte com fade curto (0,3 s) entre telas. Zoom: aproximação lenta (no máximo 8%) na região do destaque.
Destaques: contorno azul do Gyde (#3b82f6) com cantos arredondados, sem setas animadas.
Música de fundo: **não incluída**. Não há uma trilha com licença livre neste projeto; a narração fica sozinha, o que
também ajuda a entender. Se quiser música, use uma trilha com licença que permita uso e deixe a uns −28 dB.

## Narração e texto na tela

A narração abaixo é a legenda (uma frase por linha, na ordem). O texto curto na tela fica no canto superior esquerdo
de cada cena.

**0. Abertura** · tela: "Como instalar o Gyde no Windows"
- Neste vídeo, você vai instalar o Gyde no Windows e começar a usar, passo a passo.

**1. O que é o Gyde** · tela: "1. O que é o Gyde"
- O Gyde é um tutor de programação com inteligência artificial, em português e de graça.
- Ele explica o erro antes de corrigir, para você aprender de verdade.
- Monta um plano de prática no seu nível, com exercícios e projetos guiados.
- E tem a Forja, um agente que trabalha no seu projeto e mostra tudo o que mudou.

**2. Onde baixar** · tela: "2. Onde baixar"
- A versão oficial fica na página do Gyde no GitHub.
- No lado direito, clique em Releases e abra a versão mais nova.

**3. O arquivo certo** · tela: "3. O arquivo certo"
- Em Assets, baixe o arquivo Gyde Setup, que termina em ponto e x e.
- Os outros arquivos servem para as atualizações e para quem programa. Você não precisa deles.

**4. Requisitos** · tela: "4. O que você precisa"
- Você precisa do Windows dez ou onze, de uns quinhentos megabytes livres e de internet para a inteligência artificial.
- Não precisa ser administrador do computador, nem instalar mais nada antes.

**5. Começar a instalação** · tela: "5. Começar a instalação"
- Abra o arquivo que você baixou.
- Se o Windows disser que protegeu o computador, é porque o instalador não tem uma assinatura paga.
- Se você baixou da página oficial, clique em Mais informações, e depois em Executar assim mesmo.
- Na primeira tela, deixe marcado Apenas para mim e clique em Próximo.

**6. Concluir** · tela: "6. Concluir a instalação"
- Deixe a pasta sugerida e clique em Instalar.
- Espere alguns segundos.
- Deixe marcado Executar o Gyde e clique em Concluir.

**7. Abrir o Gyde** · tela: "7. Abrir o Gyde"
- O Gyde abre numa janela própria. Na primeira vez, passa um vídeo curto: aperte Esc para pular.
- Nos outros dias, abra pelo menu Iniciar, digitando Gyde, ou pelo atalho na Área de Trabalho.

**8. Configuração inicial** · tela: "8. Configuração inicial"
- Clique em Criar conta. A conta fica só no seu computador: qualquer e-mail serve, e nada é enviado.
- Depois, responda o questionário. Ele diz ao Gyde o que você quer aprender e qual é o seu nível.
- Para a inteligência artificial, o Gyde usa o FreeLLMAPI, um programa grátis.
- Instale o FreeLLMAPI pelo link do guia de instalação e coloque nele uma chave grátis do Google.
- Depois, no ícone do FreeLLMAPI perto do relógio, clique em Copy Key, e cole em Configurações, IA e modelos.

**9. Primeira conversa** · tela: "9. Primeira conversa"
- Para conversar, escreva sua dúvida na caixa de baixo e aperte Enter.
- Embaixo de cada resposta aparece o modelo que respondeu de verdade.

**10. Prática e questionário** · tela: "10. Prática"
- Na Prática fica o seu plano, montado a partir do questionário.
- Tem exercícios com testes automáticos, exercícios guiados e projetos guiados de todas as linguagens.
- Para mudar o plano, refaça o questionário. O seu progresso continua.

**11. Forja** · tela: "11. Forja (opcional)"
- A Forja é opcional. Clique em Abrir pasta do projeto, escolha a pasta e diga o que você quer.
- Ela lê os arquivos, edita, roda os testes e mostra o resumo do que mudou.
- Apagar arquivos ou instalar pacotes sempre pede a sua confirmação, e o botão Desfazer volta tudo.

**12. Problemas comuns** · tela: "12. Se algo der errado"
- Se aparecer que a chave do FreeLLMAPI não foi configurada, clique no atalho do aviso e cole a chave em IA e modelos.
- Se aparecer que o FreeLLMAPI não está respondendo, abra o FreeLLMAPI e tente de novo.
- Se as respostas ficarem lentas, coloque mais chaves grátis no FreeLLMAPI.
- Se o Gyde não abrir, clique em Tentar de novo. Se continuar, abra o registro e mande junto com a descrição do problema.

**13. Atualizações e suporte** · tela: "13. Atualizações e ajuda"
- O Gyde avisa quando sai uma versão nova, e atualizar não apaga os seus dados.
- O guia completo, as novidades e o lugar para pedir ajuda ficam na página do Gyde no GitHub.

**14. Encerramento** · tela: "Bons estudos!"
- Pronto! Agora é só começar. Bons estudos!

## Produção

Tudo roda neste computador, com o instalador gerado por `npm run dist:win`:

1. `powershell -File ferramentas\tutorial\capturar-instalador.ps1`: telas reais do instalador e do app aberto por ele
   (instala, fotografa, desinstala e apaga só o que criou).
2. `node ferramentas/tutorial/capturar-app.mjs`: telas reais do Gyde instalado, com a IA de verdade (a chave vai
   pelo ambiente do processo, nunca aparece).
3. `node ferramentas/tutorial/narrar.mjs --motor windows`: a narração, frase por frase, a partir das linhas acima,
   com a voz **Microsoft Maria** (português do Brasil) do próprio Windows. É a voz desta versão do vídeo: o Gemini TTS
   grátis permite só 10 pedidos por dia por modelo e a cota acabou no meio. Sem `--motor`, o mesmo roteiro usa o Gemini
   TTS (chave GEMINI_API_KEY do `.env`), guardando cada frase em cache para continuar em outro dia.
4. `node ferramentas/tutorial/montar-video.mjs`: monta as cenas (`video.html`), grava quadro a quadro e junta com a
   narração (ffmpeg), gerando `instalar-o-gyde.mp4` e as legendas `instalar-o-gyde.vtt`.
