# Avaliação da IA do Gyde

Medida com chamadas reais ao FreeLLMAPI deste computador, sem números de fora. Cada resultado vem de uma resposta
conferida automaticamente. As amostras são pequenas: servem para comparar versões e escolher padrões, não como ranking
geral. Os modelos grátis e o roteamento do FreeLLMAPI mudam de um dia para o outro.

**Nada aqui compara o Gyde com ChatGPT, Claude, Gemini ou Grok.** Isso exigiria testes independentes e comparáveis, que não
foram feitos. Como a inteligência funciona: [inteligencia.md](../inteligencia.md).

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
Cenários maiores (projetos com muitos arquivos, tarefas longas) não foram medidos.

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
