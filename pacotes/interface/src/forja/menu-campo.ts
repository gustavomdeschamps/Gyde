// Menu do campo da Forja: "/" no começo abre os comandos; "@" abre os arquivos do projeto. Função pura (testada com
// node --test): recebe o texto e a posição do cursor e diz o que mostrar e o que trocar ao escolher.

export interface ComandoForja { nome: string; descricao: string; texto?: string; acao?: 'desfazer' }
export const COMANDOS_FORJA: ComandoForja[] = [
  { nome: 'testes', descricao: 'Rodar os testes e explicar o resultado, sem mudar nada', texto: 'Rode os testes do projeto e me diga o resultado. Se algum falhar, explique o motivo, sem mudar nenhum arquivo.' },
  { nome: 'corrigir', descricao: 'Achar o que falha nos testes, corrigir e rodar de novo', texto: 'Rode os testes, ache o que está falhando, corrija o código (não o teste, a não ser que o teste esteja errado) e rode de novo.' },
  { nome: 'explicar', descricao: 'Explicar como o projeto funciona e como rodar', texto: 'Explique como este projeto funciona: o que cada parte faz, como rodar e como testar. Não mude nada.' },
  { nome: 'revisar', descricao: 'Revisar o código e listar o que melhorar, sem mudar', texto: 'Revise o código do projeto (bugs, segurança, legibilidade) e liste o que melhorar, do mais importante ao menos. Não mude nada.' },
  { nome: 'gyde-md', descricao: 'Criar o GYDE.md com as instruções do projeto para a Forja', texto: 'Crie um arquivo GYDE.md na raiz com as instruções deste projeto para a Forja: como instalar, rodar e testar, o estilo do código e o que não deve ser mexido. Baseie-se no que você ler nos arquivos; não invente comandos.' },
  { nome: 'desfazer', descricao: 'Desfazer a última tarefa da Forja', acao: 'desfazer' },
];

export interface ItemMenu { rotulo: string; descricao?: string; valor: string; comando?: ComandoForja }
export interface Menu { tipo: 'comando' | 'arquivo'; itens: ItemMenu[]; inicio: number; fim: number }

/** O que o menu mostra para este texto e cursor (ou null: menu fechado). */
export function menuDoCampo(texto: string, cursor: number, arquivos: string[], limite = 8): Menu | null {
  const antes = texto.slice(0, cursor);
  const cmd = /^\/([\w-]*)$/.exec(antes);
  if (cmd) {
    const q = cmd[1]!.toLowerCase();
    const itens = COMANDOS_FORJA.filter((c) => c.nome.startsWith(q)).map((c) => ({ rotulo: `/${c.nome}`, descricao: c.descricao, valor: c.texto ?? '', comando: c }));
    return itens.length ? { tipo: 'comando', itens, inicio: 0, fim: cursor } : null;
  }
  const arq = /(^|\s)@([\w./\\-]*)$/.exec(antes);
  if (arq) {
    const q = arq[2]!.replaceAll('\\', '/').toLowerCase();
    // primeiro os que começam pelo que foi digitado (no nome ou no caminho), depois os que contêm
    const pontua = (a: string) => { const l = a.toLowerCase(), nome = l.split('/').pop()!; return nome.startsWith(q) ? 0 : l.startsWith(q) ? 1 : l.includes(q) ? 2 : -1; };
    const itens = arquivos.map((a) => [a, pontua(a)] as const).filter(([, p]) => p >= 0).sort((x, y) => x[1] - y[1] || x[0].length - y[0].length || x[0].localeCompare(y[0]))
      .slice(0, limite).map(([a]) => ({ rotulo: a.split('/').pop()!, descricao: a, valor: `@${a} ` }));
    return itens.length ? { tipo: 'arquivo', itens, inicio: cursor - arq[2]!.length - 1, fim: cursor } : null;
  }
  return null;
}

/** Texto e cursor depois de escolher um item do menu. */
export function escolher(texto: string, menu: Menu, item: ItemMenu): { texto: string; cursor: number } {
  const novo = texto.slice(0, menu.inicio) + item.valor + texto.slice(menu.fim);
  return { texto: novo, cursor: menu.inicio + item.valor.length };
}
