// Canal entre a Forja e a Cidade do código: quando a Forja lê, edita, cria ou apaga um arquivo, a Forja avisa aqui
// e a Cidade (se estiver aberta) acende o prédio daquele arquivo. Sem a Cidade aberta, ninguém escuta e nada acontece.
export type TipoSinal = 'ler' | 'editar' | 'criar' | 'apagar';
export interface SinalCidade { tipo: TipoSinal; caminho: string }

const ouvintes = new Set<(s: SinalCidade) => void>();
// Os avisos dos últimos 15 s ficam guardados e vão para quem começa a ouvir: quem abre a Cidade logo depois de a Forja
// ler um arquivo também vê essa leitura (antes, ela se perdia se a Cidade abrisse um instante depois).
const RECENTE_MS = 15_000;
let recentes: { sinal: SinalCidade; em: number }[] = [];
export function ouvirCidade(f: (s: SinalCidade) => void): () => void {
  ouvintes.add(f);
  const agora = Date.now();
  recentes = recentes.filter((r) => agora - r.em < RECENTE_MS);
  for (const r of recentes) f(r.sinal);
  return () => { ouvintes.delete(f); };
}
export function avisarCidade(s: SinalCidade): void {
  recentes = [...recentes, { sinal: s, em: Date.now() }].slice(-20);
  for (const f of ouvintes) f(s);
}

// Evento da Forja (como chega do servidor) → sinal para a Cidade. "ler" vem na hora em que a Forja pede a ferramenta;
// editar/criar/apagar vêm do resultado, que diz o que de fato mudou no arquivo.
export function sinalDoEvento(ev: { tipo: string; nome?: unknown; args?: unknown; ok?: unknown; caminho?: unknown; mudanca?: unknown }): SinalCidade | null {
  if (ev.tipo === 'ferramenta' && ev.nome === 'ler') {
    const caminho = (ev.args as { caminho?: unknown } | undefined)?.caminho;
    return typeof caminho === 'string' && caminho ? { tipo: 'ler', caminho } : null;
  }
  if (ev.tipo === 'resultado' && ev.ok && typeof ev.caminho === 'string' && ev.caminho) {
    const tipo = ev.mudanca === 'criado' ? 'criar' : ev.mudanca === 'modificado' ? 'editar' : ev.mudanca === 'apagado' ? 'apagar' : null;
    return tipo ? { tipo, caminho: ev.caminho } : null;
  }
  return null;
}
