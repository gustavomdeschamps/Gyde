# Avaliação da IA do Gyde

Medida com chamadas reais ao FreeLLMAPI deste computador, sem números de fora. Cada resultado vem de uma resposta
conferida automaticamente. As amostras são pequenas: servem para comparar versões e escolher padrões, não como ranking
geral. Os modelos grátis e o roteamento do FreeLLMAPI mudam de um dia para o outro.

**Nada aqui compara o Gyde com ChatGPT, Claude, Gemini ou Grok.** Isso exigiria testes independentes e comparáveis, que não
foram feitos. Como a inteligência funciona: [inteligencia.md](../inteligencia.md).

## Forja na Fase 2 (18/11/2026)

`ferramentas/avaliar-forja.mjs --provedor nvidia,groq`, 3 execuções de cada cenário, a versão nova contra a 2.5.0
(cópia com `git worktree`). Resultados: [fase 2](forja-2026-11-18-fase2.json), [2.5.0](forja-2026-11-18-v250.json).

| Grupo | 2.5.0 | Fase 2 |
|---|---|---|
| Pequenos (4 cenários) | 12/12 | 12/12 |
| Difíceis (4 cenários) | 12/12 | 12/12 |
| Redesenhar site | 0/3 | 1/3 |
| Tempo mediano | 40 s | 28 s |

Pequenos e difíceis já estavam no teto: a medição não tem como mostrar ganho neles. O que a Fase 2 muda (verificação
depois da última mudança, aviso de afirmação sem base, quebra de laço, argumentos conferidos) é conferido pelos testes
com o provedor falso, que forçam cada situação.

**Cenário novo, "redesenhar site"** (`ferramentas/cenario-forja-site.mjs`): um site com problemas de acessibilidade e
de celular. Passa se o build roda, o axe-core (WCAG 2.1 A e AA) não acha violação séria ou crítica, a página cabe em
375 px com a meta viewport, a mudança vai além da paleta e o conteúdo continua. Antes de medir, o critério foi
conferido com o site original (falha em 3 itens) e com um redesenho feito à mão (passa em todos).

**Conferência de site da Forja**, A/B no mesmo período, n = 6 de cada lado:
[com](forja-site-2026-11-18-com-conferencia.json) 5/6, [sem](forja-site-2026-11-18-sem-conferencia.json) 4/6;
diferença +17 pontos, intervalo de 90% de -17 a +50 (incerto). Tempo mediano 115 s contra 249 s. Todas as falhas
foram de contraste de cor. A primeira versão da conferência não ajudou (lia as cores do tema escuro e ignorava
degradês); foi corrigida antes desta rodada, olhando uma falha deste mesmo cenário, o que é uma ressalva.

## Guia de estilo das respostas (18/11/2026)

`ferramentas/avaliar-estilo.mjs` com os 40 pedidos de `ferramentas/pedidos-estilo.mjs` (curtos, médios e longos;
conceito, código, git, SQL, dúvidas vagas), 2 execuções de cada, guia novo contra o anterior, mesmos modelos (NVIDIA e
Groq) dos dois lados. Critérios conferidos por programa, sem nota dada por IA: começa pela resposta; sem fórmula de
abertura ou fecho ("Claro!", "Espero ter ajudado"); tamanho proporcional ao pedido; o código dos blocos roda; não diz
que testou ou rodou algo. Resultados guardados em [estilo-2026-11-18.json](estilo-2026-11-18.json).

| Critério | Guia anterior | Guia novo | n por lado |
|---|---|---|---|
| Nota geral | 97% | 99% | 80 |
| Começa pela resposta | 100% | 100% | 80 |
| Sem fórmula de abertura ou fecho | 100% | 100% | 80 |
| Tamanho proporcional | 95% | 99% | 80 |
| O código roda | 87% | 98% | 45 |
| Não inventa sucesso | 98% | 100% | 80 |

Diferença na nota: **+3 pontos, intervalo de 90% de +1 a +4** (reamostragem). Mediana de palavras 42 contra 50; tempo
mediano 4,5 s contra 4,3 s (a verificação do código custa um pouco). 8 respostas tiveram o código corrigido pela
verificação. Os dois critérios de "vibe" mais visíveis (começar pela resposta, sem fórmula) já estavam em 100% no guia
anterior com esses modelos, então a medição não mostra ganho neles. O critério "o código roda" conta como falha um
bloco que mostra um erro de propósito sem avisar antes, o que pesa um pouco contra o guia anterior.

## Provedores diretos (09/11/2026)

Medições com as chaves grátis ligadas direto (NVIDIA, Google, Groq e Mistral), sem o FreeLLMAPI. São a base de
`pacotes/servidor/ia/medicoes.json`, que o roteador usa para escolher o modelo de cada pedido.

| Arquivos | O que mede |
|---|---|
| `provedor-*.json` | as 17 categorias acima, um provedor por vez (`provedor-google-sozinho` sem cair em outro) |
| `forja-*.json` | a Forja com as tarefas de `ferramentas/avaliar-forja.mjs` (`forja-groq-corrigido`: depois do conserto do erro 400 do Groq) |
| `chat-*.json` | o chat (tempo e acertos), inclusive a dupla NVIDIA + Groq |

## Modelos em 17 categorias (04/11/2026)

`ferramentas/avaliar-modelos.mjs`, com as tarefas de `ferramentas/avaliacao-tarefas.mjs`. A correção é automática: código roda
contra testes, SQL roda num banco de verdade, números são conferidos com o valor calculado.

| Categoria | Como é corrigida |
|---|---|
| Conversa, pergunta objetiva | tamanho, português, sem títulos nem emoji; resposta certa |
| Raciocínio (3) | resultado exato de conta, ordem e conjuntos |
| Código JS, Python | 6 casos; `assert` no código corrigido |
| SQL | a consulta roda em SQLite com dados de teste |
| Frontend | HTML gerado, inclusive escapar o que vem do usuário |
| Backend (2) | validação com 7 casos; limitador de pedidos passo a passo |
| Escrita (2) | só as regras pedidas (acróstico, palavras proibidas, pronto para enviar). **A qualidade do texto não é medida** |
| Análise (2) | números de um log calculados aqui; dizer que a informação não está no texto |
| Instruções, contexto, etapas | formato exato; usar o que foi dito antes na conversa; todas as etapas na ordem |
| Tutor | explicar sem entregar o código corrigido |
| Agente, projeto grande | formato da Forja; ir ao arquivo certo num pedido grande |
| Revisão (2) | achar um bug plantado; não inventar problema em código certo |
| Imagem, ferramentas | dizer as duas cores de um PNG; chamar a ferramenta nativa |

"Limite" é a recusa do provedor (413/429), contada à parte: é indisponibilidade naquele momento, não erro do modelo. Ordem
da tabela: acertos com correção de amostra pequena. A qualidade por categoria fica em `pacotes/servidor/ia/medicoes.json`.

| Modelo pedido | Acertos / respondidas | Limite | Tempo mediano | Imagem | Ferramenta nativa | Quem respondeu |
|---|---|---|---|---|---|---|
| `qwen3.8-27b` | 37/41 | 5 | 0,6 s | sim | sim | groq |
| `poolside-laguna-xs-2.1` | 40/45 | 2 | 1,5 s | não medido | sim | nvidia |
| `fusion` | 21/23 | 0 | 5,5 s | sim | sim | fusion |
| `claude-sonnet-4-5` | 41/47 | 0 | 1,8 s | sim | sim | google, groq, nvidia, openrouter |
| `gpt-oss-120b` | 38/44 | 3 | 1,2 s | não medido | sim | groq |
| `auto` | 39/46 | 0 | 3,0 s | sim | sim | google, groq, nvidia |
| `muse-glimmer-30b` | 21/25 | 0 | 27,1 s | sim | sim | nvidia |
| `gpt-oss-20b` | 31/38 | 2 | 1,1 s | não medido | sim | groq |
| `nemotron-3-ultra-550b` | 5/5 | 1 | 41,6 s | não medido | sim | nvidia |
| `command-a` | 18/22 | 21 | 2,6 s | não medido | sim | cohere |
| `mistral-code` | 35/45 | 2 | 1,5 s | não medido | sim | mistral |
| `codestral` | 35/45 | 2 | 1,5 s | não medido | sim | mistral |
| `gemini-flash-lite` | 15/19 | 28 | 2,7 s | não medido | não medido | google |
| `north-mini-code` | 22/31 | 13 | 5,3 s | não medido | sim | cohere, openrouter |
| `dots3-note-preview` | 10/14 | 11 | 10,7 s | não medido | não medido | openrouter |
| `claude-opus-4-5` | 17/25 | 0 | 2,3 s | sim | sim | google, groq, mistral, nvidia, openrouter |
| `claude-haiku-4-5` | 14/21 | 0 | 5,0 s | sim | sim | google, groq, openrouter |
| `gemini-3.5-flash` | 8/12 | 11 | 7,8 s | não medido | não medido | google |
| `command-a-reasoning` | 11/18 | 3 | 6,1 s | não medido | sim | cohere |
| `gemini-3.8-flash` | 0/0 | 20 | — | não medido | não medido | — |
| `gemini-2.5-flash` | 0/0 | 20 | — | não medido | não medido | — |
| `nemotron-3-super-120b` | 0/0 | 20 | — | não medido | não medido | — |
| `gemma-4-31b` | 0/0 | 23 | — | não medido | não medido | — |
| `glm-4.7-flash` | 2/5 | 15 | 52,9 s | não medido | não medido | zhipu |

O que isso mostrou:

- **Nome não diz quem responde.** Os nomes `claude-*` foram atendidos por qwen, gpt-oss, Gemini e outros. `claude-sonnet-4-5` e
  `claude-opus-4-5`, com rotas parecidas, tiveram resultados bem diferentes.
- **Rápido e bom não quer dizer disponível.** O `qwen3.8-27b` responde em cerca de 0,6 s e acerta muito, mas aceita poucas
  chamadas por minuto e recusa pedidos grandes.
- **Grátis não é ilimitado.** `gemini-3.8-flash`, `gemini-2.5-flash`, `nemotron-3-super-120b` e `gemma-4-31b` não responderam nenhuma
  tarefa nesta conta, nestes dias.
- **`fusion` não entra na escolha automática:** acerta muito, mas chama vários modelos a cada pedido.

**Limite da medição:** um erro no corretor (acento em palavras como "você") pode ter reprovado respostas certas em português
nas tarefas de conversa e tutor destas rodadas de modelos. Ele foi corrigido antes da rodada 2 de estratégias.

## Estratégias: antes e depois

`ferramentas/avaliar-estrategias.mjs`: as mesmas 19 tarefas, 2 tentativas cada, passando pelo Gyde inteiro. "Fluxo antigo" é a ordem
fixa e a instrução única de antes. "Um modelo", "Com revisão" e "Comparada" são forçadas, mesmo onde o Gyde não as escolheria.

| Estratégia | Rodada 1 | Rodada 2 | Total | Chamadas por pedido (rodada 2) | Tempo mediano (rodada 2) |
|---|---|---|---|---|---|
| Fluxo antigo | 33/38 | 31/38 | **64/76** | 1,0 | 1,1 s |
| Um modelo, núcleo novo | 37/38 | 34/38 | **71/76** | 1,0 | 1,6 s |
| Automático, modo Equilibrado | 32/38 | 34/38 | **66/76** | 1,0 | 1,5 s |
| Com revisão | 35/38 | 35/38 | **70/76** | 3,2 | 5,9 s |
| Comparada | 36/38 | 35/38 | **71/76** | 2,5 | 2,4 s |
| Automático, modo Capricho | 34/38 | 34/38 | **68/76** | 2,7 | 5,8 s |
| Especialistas (só 6 tarefas de software) | 11/12 | 9/12 | **20/24** | 4,6 | 22 s |

A rodada 1 tinha o erro do corretor, que pode ter reprovado respostas certas de conversa, e não guardou os textos para recontar.
Por isso, a diferença entre "Um modelo" e "Automático" (71 x 66) não é conclusiva. A rodada 2 é a mais confiável, e nela os dois
empatam.

Leitura honesta:

- **Instruções e escolha novas ajudaram:** "Um modelo" acertou mais que o fluxo antigo nas duas rodadas, com a mesma quantidade
  de chamadas e um pouco mais de tempo. Na rodada 2, o ganho aparece em conversa e análise, em amostra pequena.
- **A colaboração não mostrou ganho nestas tarefas.** Custa de 2,5 a 4,6 vezes mais chamadas e acerta o mesmo, dentro da variação.
  Muitas tarefas são fáceis para os modelos atuais, então não há muita folga para melhorar: tarefas mais difíceis podem
  mudar o resultado, e isso não foi medido.
- **Colaborar também pode piorar:** com revisão, a contagem do log saiu errada em tentativas em que um modelo só acertou, e uma
  síntese começou explicando as "duas respostas" em vez de responder.

O que mudou por causa disso: um modelo só é o padrão; especialistas vêm desligados; a revisão só reescreve por problema grave;
a síntese ficou proibida de mencionar a comparação; a colaboração ganhou prazo total e queda para um modelo só. Depois
desses ajustes, nas categorias mais afetadas (análise, backend, etapas, raciocínio, 2 tentativas cada), a revisão acertou 15 de
15 (mais 1 pedido que estourou o prazo da medição, o caso que motivou o prazo total) e a comparação, 14 de 16. A queda para um
modelo só tem teste com provedor falso, mas não foi medida com IA real.

Os dados estão em `estrategias-rodada1-2026-11-04.json`, `estrategias-2026-11-04.json` e `estrategias-ajuste-2026-11-05.json`.

## Forja em projetos reais (`ferramentas/avaliar-forja.mjs`)

Quatro cenários, 3 tentativas cada, conferidos no disco no fim:

| Cenário | O que precisa acontecer |
|---|---|
| **bug** | o teste passa, sem a Forja mexer no teste |
| **preservar** | a função nova funciona, tem teste novo, e a mudança da pessoa ainda não salva no git continua no arquivo |
| **front-back** | a API passa a devolver `hora` e a tela passa a mostrar |
| **pergunta** | nenhum arquivo muda e a resposta explica como rodar os testes |

| Versão | Completos | Tempo mediano | Maior tempo |
|---|---|---|---|
| 29/10/2026 | 11/12 | 21 s | 110 s |
| Núcleo multimodelo, com revisão independente (04/11/2026) | **12/12** | 17 s | 197 s |

A diferença de um cenário está dentro da variação. O ganho medido não é de qualidade, e a revisão pode alongar uma tarefa.

## Skills e agentes medidos por RESULTADO (17/11/2026)

A medição da 2.4.0 conferia sobretudo se a resposta seguia o formato que a própria skill manda (por isso tantos "sem a
skill" davam 0%). Esta substitui aquela (que continua no histórico do git). `ferramentas/avaliar-resultado.mjs`, com
NVIDIA + Groq, nos mesmos modelos para os dois lados:

- **Conjunto separado:** 38 tarefas novas (`ferramentas/tarefas-resultado.mjs`), que não foram usadas para escrever
  nem para testar as skills.
- **Nota pelo resultado, não pelo formato:** o código da resposta roda com casos escondidos; a consulta SQL roda num banco
  e o resultado é comparado; o modelo de banco recebe inserções que precisam passar ou falhar; a página passa no axe-core
  (WCAG A e AA) num navegador e é medida em 375 px; os comandos de git rodam num repositório temporário; o script Python
  move arquivos de verdade; os tipos do JSDoc são conferidos pelo TypeScript. Nota = fração das conferências que passaram.
- **Sem depender do formato:** cada conferência dá a mesma nota com o código em bloco, dentro da linha ou solto no texto
  (`ferramentas/conferir-tarefas-resultado.mjs` prova isso com respostas de referência, e o teste automático também).
- **5 execuções com e 5 sem** cada skill e cada agente, por tarefa. Incerteza: intervalo de 90% da diferença por
  reamostragem (bootstrap). "Melhora" quando o intervalo inteiro fica acima de zero; "tendência" quando a diferença é
  positiva mas o intervalo inclui zero.

**Correções feitas durante a medição (todas valem para os dois lados, e a medição foi refeita depois de cada uma):**
1. A conferência só lia código em bloco (```); respostas certas com o código dentro da linha ou solto tiravam 0.
2. A página solta no texto (sem bloco) não era encontrada.
3. As conferências de página rodavam em paralelo na mesma aba do navegador: uma trocava a página no meio da medida da
   outra. Agora usam a aba uma de cada vez. As medidas de página anteriores a isso foram descartadas.
4. O limite de 3.000 tokens cortava páginas longas; o chat não tem esse limite, então a medição passou a 8.000.
5. O Python, rodando pelo teste no Windows, quebrava ao imprimir acentos e setas (no terminal da pessoa não quebra):
   passou a rodar em UTF-8.
6. Uma tarefa deixava o ambiente ambíguo (navegador ou servidor) e passou a dizer "servidor, em Node".

**Reescritas antes do resultado final:** depurador e revisão de código (passaram a entregar a função inteira corrigida,
e não só a linha), node-express (um arquivo só, sem pacote extra), banco-no-codigo (a API certa do node:sqlite, que não
tem `db.transaction`), regex, json-csv, acessibilidade, formulário, front-end, layout e o agente de segurança.

### Resultado final

Melhoraram e ficaram:

| Skill ou agente | Nota com / sem | Diferença (intervalo de 90%) | Execuções com / sem | Veredito | No catálogo |
|---|---|---|---|---|---|
| changelog-versoes | 100% / 60% | +40 (20 a 50) | 5 / 5 | melhora | fica |
| banco-no-codigo | 75% / 50% | +25 (25 a 25) | 5 / 5 | melhora | fica |
| estatistica-basica | 93% / 73% | +20 (7 a 33) | 5 / 5 | melhora | fica |
| regex | 78% / 63% | +15 (0 a 30) | 5 / 5 | tendência | fica |
| acessibilidade-web | 100% / 93% | +7 (3 a 13) | 10 / 10 | melhora | fica |

Não melhoraram (ficaram iguais ou piores) e saíram:

| Skill ou agente | Nota com / sem | Diferença (intervalo de 90%) | Execuções com / sem | Veredito | No catálogo |
|---|---|---|---|---|---|
| design-visual | 85% / 85% | 0 (-15 a 15) | 5 / 5 | não melhora | saiu |
| agente seguranca | 99% / 100% | -1 (-3 a 0) | 20 / 20 | não melhora | saiu |
| senhas-seguras | 96% / 100% | -4 (-12 a 0) | 5 / 5 | não melhora | saiu |
| json-csv | 95% / 100% | -5 (-15 a 0) | 5 / 5 | não melhora | saiu |
| landing-page | 80% / 85% | -5 (-15 a 5) | 5 / 5 | não melhora | saiu |
| agente designer | 79% / 88% | -9 (-16 a -1) | 20 / 20 | não melhora | saiu |
| layout-css | 67% / 80% | -13 (-27 a 0) | 5 / 5 | não melhora | saiu |

Também saíram, porque o modelo já acertava 100% das conferências sem elas (5 execuções de cada lado): agente depurador, agente documentador, agente iniciante, agente testador, api-rest, app-celular, conflitos-git, consumir-api, desempenho-codigo, documentador, explicador-erros, formulario-web, front-end, git-sem-medo, github-actions, indices-consultas, injecao-xss, jogo-canvas, ler-codigo, limpar-dados, linha-de-comando, logica-de-jogo, logica-programacao, modelagem-banco, node-express, publicar-site, refatorador, revisao-seguranca, revisor-codigo, scripts-arquivos, segredos-env, sql-na-pratica, tarefas-agendadas, testes-automatizados.

**De onde vêm os números:** as tarefas de página e as das skills reescritas por último vêm da última rodada; as outras, da
rodada anterior, já com as conferências corrigidas (a única mudança depois dela foi a fila do navegador, que só afeta
páginas). **Repetição:** changelog-versoes deu +40 nas duas rodadas válidas; estatistica-basica (+20) e regex (+15)
não mostraram ganho na rodada anterior. Trate esses dois como incertos.

**O que isso quer dizer:** com os modelos grátis de hoje (os primeiros da fila foram nemotron-3-ultra, gpt-oss-120b e
laguna-xs), as tarefas comuns de programação já saem certas sem skill nem agente. Onde a skill ajudou, foi em detalhe que
o modelo erra sozinho (o número da versão pelo SemVer, a API do node:sqlite, a mediana com valor extremo, o contraste do
botão). Amostra pequena: 5 execuções de cada lado, numa tarefa por skill (duas em algumas). "Tendência" não é prova.

**Não medidas por resultado** (sem tarefa com resultado objetivo; continuam no catálogo, marcadas "Sem teste de
resultado"): análise com pandas e Flask (o Python desta máquina não tem as bibliotecas), jogo em Python, fórmulas de
planilha, gráficos, componentes React, planejar projeto, depurar com perguntas, commits, README, documentar API,
entrevista, explicar conceito, exercícios, plano de estudos, design de jogo e o agente Planejador.

Detalhe de cada execução: [resultado-2026-11-17.json](resultado-2026-11-17.json).

### Forja mais forte (13 a 16/11/2026)

Quatro cenários difíceis novos (`ferramentas/cenarios-forja-dificeis.mjs`), com testes escondidos que a Forja não vê:
**bug-espalhado** (dois bugs em arquivos diferentes), **teste-engana** (o erro aparece em `formatar.js`, a causa está em
`ler.js`), **pedido-grande** (um campo novo do modelo à tela, com testes) e **achar-arquivo** (o bug está em 1 de 44 arquivos).
Sempre NVIDIA + Groq. Cada mudança só ficou se a medição melhorou, sem deixar as tarefas pequenas mais lentas.

| Mudança | Execuções | Pequenos | Difíceis | Ficou? |
|---|---|---|---|---|
| Base (`forja-base-2026-11-13.json`) | 16 | 8/8, mediana 13 s | 6/8, mediana 33 s | — |
| Plano aprovado antes de tarefa grande (`forja-plano-*.json`, só pedido-grande) | 4 + 4 da base | — | 3/4 contra 4/4 da base; o dobro de rodadas | virou opção desligada |
| Robustez: `<tool_call>` no texto vira ação; "vou ler..." não encerra (`forja-robustez-*.json`) | 16 | 8/8, mediana 11 s | 8/8, mediana 20 s | sim |
| Conserto de trecho com espaços e recuo (`forja-conserto-trecho-*.json`) | 16 | 8/8, 12 s | 8/8, 32 s; só 1 edição falhou em 16 | não (sem efeito medível) |
| Testes depois de cada rodada, desfazendo se quebrar (`forja-rede-testes-*.json`) | 16 | 8/8, 20 s | 8/8, 43 s | não (mais lenta, sem ganho) |
| Contexto enxuto pelo mapa da Cidade (`forja-contexto-ab-*.json`, A/B intercalado) | 16 + 16 | 8/8, 23 s contra 36 s; lê 1,4 arquivo contra 2,8 | 8/8, 55 s contra 42 s; lê 3,4 contra 4,4 | sim |

**Leia com cuidado.** São amostras pequenas: o mesmo cenário (teste-engana) variou de 0/2 a 4/4 na base. Os tempos
dependem muito do provedor naquela hora: na primeira rodada do A/B, uma pergunta que nem usa a mudança levou 83 s, e duas
tarefas passaram de 10 minutos. Por isso o último teste foi intercalado (versão nova e anterior uma depois da outra). O que
os modelos grátis não conseguiram: com plano, um deles respondeu "Desculpe, vou ler os arquivos" e parou; outro escreveu
a ação num formato próprio (`<tool_call>`), que a Forja passou a entender.

## Histórico da Forja (29/10/2026)

Confirmações da Forja (instalar, apagar) são sempre recusadas. A versão "antes" é o commit `d917f40`, rodando de um `git worktree`.

| Versão | Completos | O que mudou nessa rodada |
|---|---|---|
| Antes (`d917f40`) | 8/8 | — |
| Cadeia da Forja com qwen/gpt-oss na frente | 6/8 | **Pior**: os modelos via Groq recusam pedidos do tamanho dos da Forja (413/429) e a cadeia se esgotava |
| Cadeia original de volta | 7/8 | Falhou no fim: trabalho certo no disco, mas o modelo terminou com texto em vez de JSON |
| Texto puro aceito como resposta final | 6/8 | **Pior**: no 1º passo, texto solto (o modelo anunciando o que vai fazer) encerrava a tarefa vazia |
| Texto puro aceito só depois de alguma ação | 7/8 | O slot `claude-sonnet-4-5` foi roteado para `gpt-oss-120b`, que respondeu sem agir |
| Cobrar o trabalho quando o pedido manda mudar algo e nada foi feito (só sem ação nenhuma) | 7/8 | O modelo leu o arquivo e respondeu explicando, sem editar |
| Cobra quando nada mudou e nenhum comando rodou | 11/12 (3 tentativas) | Uma falha no front-back: a tela mudou, mas a API não ganhou o campo `hora` |

As proteções desta fase tratam falhas reais de quando o modelo varia, e cada uma tem teste com o provedor falso: terminar sem
fazer o trabalho pedido, terminar sem testar, terminar com texto em vez de JSON e sobrescrever um arquivo sem ter lido.
