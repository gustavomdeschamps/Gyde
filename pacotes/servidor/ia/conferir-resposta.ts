// Depois que a resposta chega inteira: acabamento do texto (filtro.ts) e, em pedidos de programação, a verificação do
// código (verificar-codigo.ts). Se o código der erro, pede a correção ao modelo (no máximo 2 vezes) e entrega a versão
// que roda; se nenhuma rodar, entrega a original com um aviso honesto. Sempre diz em uma linha o que foi conferido.
import type { MensagemIA, Router } from '../tipos.ts';
import { completar } from '../motor.ts';
import { acabamento, limparResposta } from './filtro.ts';
import { verificarCodigo } from './verificar-codigo.ts';

export const MAX_CORRECOES = 2;

export interface Conferencia { texto: string; nota: string | null; tentativas: number; verificado: boolean }

export async function conferirResposta({ texto, mensagens, router, cadeia, signal, verificar, aoStatus }: {
  texto: string; mensagens: MensagemIA[]; router: Router; cadeia: string[]; signal?: AbortSignal; verificar: boolean;
  aoStatus?: (t: string) => void;
}): Promise<Conferencia> {
  let atual = acabamento(texto);
  if (!verificar) return { texto: atual, nota: null, tentativas: 0, verificado: false };
  let v = await verificarCodigo(atual);
  if (!v.rodou) return { texto: atual, nota: null, tentativas: 0, verificado: false };
  if (!v.erros.length) return { texto: `${atual}\n\n*Código conferido: ${v.comUso ? 'rodei e não deu erro' : 'rodei e não deu erro, mas o código só define, sem exemplo de uso para conferir o resultado'}.*`, nota: 'ok', tentativas: 0, verificado: true };

  const primeiroErro = v.erros[0]!;
  const original = atual;
  for (let i = 1; i <= MAX_CORRECOES; i++) {
    if (signal?.aborted) break;
    aoStatus?.('Rodei o código e deu erro: corrigindo antes de mostrar…');
    const e = v.erros[0]!;
    try {
      const r = await completar(router, {
        cadeia, max_tokens: 4000, temperature: 0.2, tempoLimite: 60_000, signal,
        messages: [...mensagens, { role: 'assistant', content: atual }, {
          role: 'user',
          content: `Rodei o código ${e.linguagem} da sua resposta e deu este erro: ${e.erro}\nCorrija e mande a resposta completa de novo, no mesmo formato e no mesmo tom, sem comentar esta mensagem nem pedir desculpas.`,
        }],
      });
      const novo = acabamento(limparResposta(r.texto));
      const v2 = await verificarCodigo(novo);
      if (v2.rodou && !v2.erros.length) {
        return { texto: `${novo}\n\n*Código conferido: a primeira versão deu erro ao rodar (${primeiroErro.erro}) e foi corrigida.*`, nota: 'corrigido', tentativas: i, verificado: true };
      }
      if (v2.rodou) { atual = novo; v = v2; }
    } catch { break; }
  }
  return { texto: `${original}\n\n*Atenção: rodei o código e deu erro (${primeiroErro.erro}). Confira antes de usar.*`, nota: 'erro', tentativas: MAX_CORRECOES, verificado: true };
}
