// Agentes especializados do chat: papéis que o orquestrador escolhe sozinho, por regras sobre o pedido (sem chamar IA),
// e só quando o pedido precisa. Cada papel muda as instruções do modelo que responde: não gasta chamada a mais.
// A interface mostra qual agente está trabalhando ("Planejador: organizando o plano").
//
// Medição por resultado (17/11/2026, docs/avaliacao/README.md): Depurador, Testador, Revisor de segurança, Explicador
// para iniciantes, Documentador e Designer não melhoraram o resultado das tarefas (o modelo já acertava sem eles, ou
// piorou) e saíram. O Planejador fica: não há tarefa de resultado objetivo para medi-lo, e a tela diz isso.
import type { Classificacao } from './classificar.ts';

export interface Agente {
  id: string;
  nome: string;
  /** o que aparece na tela enquanto ele trabalha */
  fazendo: string;
  instrucoes: string;
  quando: (texto: string, c: Classificacao) => boolean;
}

export const AGENTES: Agente[] = [
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
