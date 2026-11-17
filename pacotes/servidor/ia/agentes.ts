// Agentes especializados do chat: papéis que o orquestrador escolhe sozinho, por regras sobre o pedido (sem chamar IA),
// e só quando o pedido precisa. Cada papel muda as instruções do modelo que responde: não gasta chamada a mais.
// Só ficam os papéis que melhoraram a resposta na avaliação (ferramentas/avaliar-agentes.mjs); os números estão em
// docs/avaliacao/README.md. A interface mostra qual agente está trabalhando ("Depurador: procurando a causa do erro").
import type { Classificacao } from './classificar.ts';

export interface Agente {
  id: string;
  nome: string;
  /** o que aparece na tela enquanto ele trabalha */
  fazendo: string;
  instrucoes: string;
  quando: (texto: string, c: Classificacao) => boolean;
}

const SOFTWARE = new Set(['codigo', 'sql', 'frontend', 'backend']);

export const AGENTES: Agente[] = [
  {
    id: 'depurador', nome: 'Depurador', fazendo: 'procurando a causa do erro',
    quando: (t) => /\b(\w+Error|\w+Exception|traceback|stack trace|deu erro|n[ãa]o funciona|bug|quebrou|est[áa] dando erro)\b/i.test(t),
    instrucoes: [
      'Papel: depurador.',
      '1. Diga em uma frase o que o erro significa.',
      '2. Aponte a linha ou o trecho culpado (no código da pessoa, não em bibliotecas).',
      '3. Explique a causa e só depois mostre a correção mínima.',
      '4. Diga como confirmar que foi resolvido (o que muda ao rodar de novo) e um teste rápido que pegaria o erro.',
      'Não reescreva o arquivo inteiro: mostre só o que muda.',
    ].join('\n'),
  },
  {
    id: 'testador', nome: 'Testador', fazendo: 'escrevendo os testes',
    quando: (t) => /\b(testes?( unit[áa]rios?| automatizados?)?|pytest|jest|vitest|node:test|junit|casos de teste|cobertura)\b/i.test(t) && /\b(escrev|cri|fa[çc]|gere|adicion|test[ea])/i.test(t),
    instrucoes: [
      'Papel: testador.',
      '1. Liste os casos antes do código: o comum, pelo menos duas bordas (vazio, zero, negativo, limite) e um caso de erro.',
      '2. Um teste por comportamento, com nome que diz o esperado.',
      '3. Use a ferramenta da linguagem (node:test, pytest, JUnit) e importe a função do arquivo dela.',
      '4. Teste o erro com assert.throws ou pytest.raises.',
      '5. Termine com o comando exato para rodar.',
    ].join('\n'),
  },
  {
    id: 'seguranca', nome: 'Revisor de segurança', fazendo: 'conferindo a segurança',
    quando: (t, c) => (SOFTWARE.has(c.tarefa) || /\b(c[óo]digo|site|app|servidor|rota|banco|node|python|php|java)\b/i.test(t))
      && /(senha|login|autentica|token|jwt|\bsql\b|query|innerhtml|upload|cookie|sess[ãa]o|permiss|chave de api|api key|\.env)/i.test(t),
    instrucoes: [
      'Papel: revisor de segurança, junto com a resposta normal.',
      'Confira e corrija no código que você entregar: consulta SQL parametrizada; texto do usuário escapado no HTML (textContent, nunca innerHTML sem sanitizar);',
      'senha com hash lento (bcrypt, scrypt ou Argon2); cada rota confere se o dado é do dono; segredos em variável de ambiente.',
      'Se o código da pessoa tiver um desses problemas, aponte com gravidade (Grave, Médio, Leve) e a correção.',
    ].join(' '),
  },
  {
    id: 'iniciante', nome: 'Explicador para iniciantes', fazendo: 'explicando passo a passo',
    quando: (t) => /\b(sou iniciante|come[çc]ando agora|n[ãa]o entendi|explica (de|bem) (um )?jeito simples|para leigos?|o que [ée] (um|uma|o|a)\b|me explica)\b/i.test(t),
    instrucoes: [
      'Papel: explicador para iniciantes.',
      '1. Definição em uma frase, sem jargão.',
      '2. Uma analogia do dia a dia, dizendo onde ela deixa de valer.',
      '3. O menor exemplo de código possível, comentado.',
      '4. Termine com UMA pergunta curta para a pessoa conferir se entendeu.',
      'Explique todo termo técnico na primeira vez que aparecer.',
    ].join('\n'),
  },
  {
    id: 'documentador', nome: 'Documentador', fazendo: 'escrevendo a documentação',
    quando: (t) => /\b(documenta|documente|documentar|readme|docstring|jsdoc|javadoc)\b/i.test(t),
    instrucoes: [
      'Papel: documentador.',
      'Para funções: use o padrão da linguagem (JSDoc, docstring, Javadoc) com descrição, cada parâmetro, retorno, erros possíveis e um exemplo.',
      'Para README: frase do que o projeto faz, pré-requisitos com versão, instalação e uso com comandos que funcionam copiando e colando, como rodar os testes.',
      'Não invente o que não está no código: marque o que a pessoa precisa preencher.',
    ].join('\n'),
  },
  {
    id: 'designer', nome: 'Designer de interface', fazendo: 'cuidando do visual e da acessibilidade',
    quando: (t) => /(bonit|feio|visual|design|layout|estilo|cores|tipografia|amador)/i.test(t) && /\b(site|p[áa]gina|tela|interface|css|html|landing|app)\b/i.test(t),
    instrucoes: [
      'Papel: designer de interface.',
      'Cores e espaçamentos em variáveis CSS no :root; uma cor principal e tons neutros; escala de espaçamento fixa (4, 8, 16, 24, 32 px).',
      'Comece pelo celular e use @media para telas maiores. Tags semânticas, label em todo campo, alt nas imagens, foco visível e contraste de texto de pelo menos 4,5:1.',
    ].join('\n'),
  },
  {
    id: 'planejador', nome: 'Planejador', fazendo: 'organizando o plano',
    quando: (t) => /\b(quero (criar|fazer|montar) (um|uma) (app|aplicativo|site|sistema|jogo|projeto)|por onde come[çc]o|como come[çc]ar (o|um) projeto|planejar)\b/i.test(t),
    instrucoes: [
      'Papel: planejador.',
      '1. Resuma a ideia em uma frase e liste no máximo 5 funções da primeira versão; diga o que fica de fora.',
      '2. Sugira as tecnologias mais simples que resolvem, com o porquê.',
      '3. Mostre a estrutura de pastas num bloco de código.',
      '4. Divida em 4 a 6 etapas, cada uma terminando em algo que dá para testar.',
      '5. Termine com "Primeiro passo agora:" e um comando ou arquivo concreto.',
    ].join('\n'),
  },
];

/** Escolhe no máximo um agente para o pedido (o primeiro da lista que serve), ou nenhum. */
export function escolherAgente(texto: string, c: Classificacao, ligados: Set<string> = new Set(AGENTES.map((a) => a.id))): Agente | null {
  if (c.tarefa === 'conversa' || c.tarefa === 'escrita' || c.tarefa === 'visao') return null;
  return AGENTES.find((a) => ligados.has(a.id) && a.quando(texto, c)) ?? null;
}

/** O texto que vai nas instruções do modelo quando o agente trabalha. */
export function textoDoAgente(a: Agente): string {
  return `Agente especializado nesta resposta: ${a.nome}. Siga este roteiro sem anunciar o papel:\n${a.instrucoes}`;
}
