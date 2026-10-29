// Relatório de erro (Configurações > Geral): junta os erros desta tela com o resumo do servidor num texto para copiar.
// Nada é enviado: a pessoa cola onde quiser (ex.: uma issue no GitHub). Conversas e chaves não entram.
import * as C from '$contratos';
import { pedir, mensagemDe } from './api.ts';
import { desktop } from './desktop.ts';

const MAX = 20;
const errosDaTela: { em: string; mensagem: string; onde: string }[] = [];
const guardar = (mensagem: string, onde: string) => {
  errosDaTela.push({ em: new Date().toISOString(), mensagem: mensagem.slice(0, 400), onde: onde.slice(0, 200) });
  if (errosDaTela.length > MAX) errosDaTela.shift();
};

// chamado uma vez, ao abrir o Gyde
export function vigiarErros() {
  addEventListener('error', (e) => guardar(e.message || 'erro sem mensagem', `${(e.filename || '').replace(location.origin, '')}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => guardar(mensagemDe(e.reason), 'promessa sem tratamento'));
}

export async function montarRelatorio(): Promise<string> {
  const linhas = ['## Relatório de erro do Gyde', ''];
  try {
    const d = await pedir('/api/diagnostico', C.Diagnostico);
    linhas.push(
      `- Gyde ${d.gyde} (${desktop ? 'app de desktop' : 'pelo código'}, modo ${d.modo}), Node ${d.node}, ${d.sistema}`,
      `- Banco: esquema ${d.esquemaBanco}`,
      `- IA: modo ${d.ia.modo}, em uso ${d.ia.ativo}; FreeLLMAPI ${d.ia.online ? 'respondendo' : 'sem resposta'}${d.ia.chave ? '' : ' (sem chave)'}; modelo local ${d.ia.offline ? 'pronto' : 'indisponível'}`,
    );
    linhas.push('', `### Erros do servidor (${d.erros.length})`);
    for (const e of d.erros) linhas.push('', `- ${e.em} · ${e.onde}: ${e.mensagem}`, ...(e.pilha ? ['```', e.pilha, '```'] : []));
    if (!d.erros.length) linhas.push(d.modo === 'publico' ? 'No modo público os erros do servidor ficam com quem cuida dele.' : 'Nenhum desde que o Gyde abriu.');
  } catch (e) {
    linhas.push(`- Não consegui falar com o servidor do Gyde: ${mensagemDe(e)}`);
  }
  linhas.push('', `### Erros desta tela (${errosDaTela.length})`);
  for (const e of errosDaTela) linhas.push(`- ${e.em} · ${e.onde}: ${e.mensagem}`);
  if (!errosDaTela.length) linhas.push('Nenhum desde que a página abriu.');
  linhas.push('', `Navegador: ${navigator.userAgent}${desktop ? ' (app de desktop)' : ''}`, `Tela: ${innerWidth}x${innerHeight}, endereço ${location.hash || '#/'}`);
  return linhas.join('\n');
}
