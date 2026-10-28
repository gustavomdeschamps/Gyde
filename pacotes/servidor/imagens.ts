// Geração de imagens pela Cloudflare Workers AI (cota diária grátis). Conta e token vêm do .env e são lidos na
// hora, porque podem ser configurados pela tela (Configurações > IA), sem reiniciar.
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { comoErro, erroGyde } from './tipos.ts';

const conta = () => process.env.CLOUDFLARE_ACCOUNT_ID || '';
const token = () => process.env.CLOUDFLARE_API_TOKEN || '';

// chamada depois de o servidor carregar o .env (por isso as variáveis são lidas aqui dentro, não no topo)
export function criarImagens({ pasta }: { pasta: string }) {
  const CF_API = (process.env.CLOUDFLARE_API_URL || 'https://api.cloudflare.com').replace(/\/+$/, ''); // os testes apontam para um falso
  const MODELO = process.env.IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
  const ativas = () => Boolean(conta() && token());

  // salva a imagem em <pasta> e devolve o endereço que a tela usa (/images/<id>.jpg)
  async function gerar(prompt: string, signal: AbortSignal) {
    if (!ativas()) throw erroGyde('A geração de imagens ainda não foi ligada. Configure em Configurações > IA e modelos.', { status: 503 });
    let res: Response;
    try {
      res = await fetch(`${CF_API}/client/v4/accounts/${conta()}/ai/run/${MODELO}`, {
        method: 'POST',
        signal,
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }),
      });
    } catch (cause) {
      if (comoErro(cause).name === 'AbortError') throw cause;
      throw erroGyde('Não consegui falar com a Cloudflare. Verifique sua internet.', { status: 502 });
    }
    const json = await res.json().catch(() => ({})) as { result?: { image?: string }; errors?: { message?: string }[] };
    if (!res.ok || !json.result?.image) {
      const msg = json.errors?.[0]?.message || `HTTP ${res.status}`;
      const dica = res.status === 401 || res.status === 403 ? ' Confira o Account ID e o token (precisa da permissão Workers AI).'
        : res.status === 429 ? ' A cota grátis de hoje acabou; tente amanhã.' : '';
      throw erroGyde(`A Cloudflare não gerou a imagem: ${msg}.${dica}`, { status: 502 });
    }
    const id = randomUUID();
    writeFileSync(path.join(pasta, `${id}.jpg`), Buffer.from(json.result.image, 'base64'));
    return `/images/${id}.jpg`;
  }

  // confere conta e token listando os modelos (não gasta a cota de imagens). Devolve o status HTTP da Cloudflare.
  async function conferir(contaNova: string, tokenNovo: string) {
    const r = await fetch(`${CF_API}/client/v4/accounts/${contaNova}/ai/models/search?per_page=1`, { headers: { Authorization: `Bearer ${tokenNovo}` }, signal: AbortSignal.timeout(15_000) });
    return r.status;
  }

  return { ativas, gerar, conferir, modelo: MODELO };
}
export type Imagens = ReturnType<typeof criarImagens>;
