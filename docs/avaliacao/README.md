# Avaliação da IA do Gyde (29/10/2026)

Medida com chamadas reais ao FreeLLMAPI deste computador, sem números de fora. Cada resultado vem de uma resposta
conferida automaticamente. As amostras são pequenas (2 ou 3 tentativas por caso): servem para comparar versões e
escolher a ordem dos modelos, não como ranking geral. Os modelos grátis e o roteamento do FreeLLMAPI mudam de um dia
para o outro.

## Modelos em tarefas do Gyde (`ferramentas/avaliar-modelos.mjs`)

Cinco tarefas, 2 tentativas cada. Cada tarefa tem uma correção automática:

- **código JS**: a função gerada roda contra 6 casos;
- **bug Python**: o código corrigido roda com `assert`;
- **tutor**: a explicação tem que estar em português, explicar o índice e não entregar o código corrigido;
- **formato da Forja**: o JSON tem que trazer as duas ações pedidas;
- **imagem**: o modelo tem que dizer as duas cores certas de um PNG gerado aqui.

Quando o provedor estava no limite por minuto (413/429), a tentativa aparece em "limite" e não conta como erro.
Os dados brutos estão em `modelos-2026-10-29.json`.

| Modelo pedido | Acertos / respondidas | Limite | Tempo mediano | Observação |
|---|---|---|---|---|
| qwen3.8-27b | 9/9 | 1 | 0,7 s | via Groq |
| gpt-oss-120b | 8/8 | 2 | 0,9 s | via Groq; a imagem não foi respondida (limite) |
| auto | 9/9 | 1 | 1,0 s | o FreeLLMAPI escolhe |
| codestral | 6/6 | 4 | 1,5 s | via Mistral |
| mistral-code | 6/6 | 4 | 1,3 s | via Mistral |
| claude-opus-4-5 (slot) | 9/10 | 0 | 3,6 s | o FreeLLMAPI mandou para `dots-3-note-preview`: errou um código |
| claude-sonnet-4-5 (slot) | 8/10 | 0 | 7,4 s | idem: errou um código e o formato da Forja |
| gemini-3.8-flash | 1/1 | 9 | 16 s | quase sempre no limite nesta conta |
| nemotron-3-super-120b | 0/0 | 10 | — | sempre no limite nesta conta |

**Decisão:** no chat, `qwen3.8-27b` e `gpt-oss-120b` passaram para a frente da fila, e os slots `claude-*` ficaram de
reserva.

## Forja em projetos reais (`ferramentas/avaliar-forja.mjs`)

Quatro cenários, cada um conferido no disco no fim:

| Cenário | O que precisa acontecer |
|---|---|
| **bug** | o teste passa, sem a Forja mexer no teste |
| **preservar** | a função nova funciona, tem teste novo, e a mudança da pessoa ainda não salva no git continua no arquivo |
| **front-back** | a API passa a devolver `hora` e a tela passa a mostrar |
| **pergunta** | nenhum arquivo muda e a resposta explica como rodar os testes |

Confirmações da Forja (instalar, apagar) são sempre recusadas. A versão "antes" é o commit `d917f40`, rodando de um
`git worktree`.

| Versão | Completos | O que mudou nessa rodada |
|---|---|---|
| Antes (`d917f40`) | 8/8 | — |
| Cadeia da Forja com qwen/gpt-oss na frente | 6/8 | **Pior**: os modelos via Groq recusam pedidos do tamanho dos da Forja (413/429) e a cadeia se esgotava |
| Cadeia original de volta | 7/8 | Falhou no fim: trabalho certo no disco, mas o modelo terminou com texto em vez de JSON |
| Texto puro aceito como resposta final | 6/8 | **Pior**: no 1º passo, texto solto (o modelo anunciando o que vai fazer) encerrava a tarefa vazia |
| Texto puro aceito só depois de alguma ação | 7/8 | O slot `claude-sonnet-4-5` foi roteado para `gpt-oss-120b`, que respondeu sem agir |
| Cobrar o trabalho quando o pedido manda mudar algo e nada foi feito (só sem ação nenhuma) | 7/8 | O modelo leu o arquivo e respondeu explicando, sem editar |
| **Atual**: cobra quando nada mudou e nenhum comando rodou | **11/12** (3 tentativas) | Uma falha no front-back: a tela mudou, mas a API não ganhou o campo `hora` |

Os arquivos `forja-*.json` têm cada rodada: passos, tempo, comandos, modelo que respondeu e cada checagem.

**Leitura honesta:**

- Nesses quatro cenários, a versão de antes já ia bem (8/8), e a atual ficou em 11/12. Com amostras desse tamanho, a
  diferença está dentro da variação do roteamento do FreeLLMAPI: os resultados não mostram uma melhora de qualidade
  medida.
- O que as rodadas mostraram foram falhas reais da Forja quando o modelo varia. As proteções novas tratam essas falhas,
  e cada uma tem um teste com o provedor falso:
  - terminar sem fazer o trabalho pedido;
  - terminar sem testar;
  - terminar com texto em vez de JSON;
  - sobrescrever um arquivo sem ter lido.
- Duas mudanças pioraram o resultado medido e foram desfeitas ou corrigidas:
  - os modelos do Groq na frente da Forja;
  - aceitar texto já no 1º passo.
- Cenários maiores (projetos com muitos arquivos, tarefas longas) não foram medidos.
