// Avaliação dos modelos do FreeLLMAPI nas tarefas do Gyde, com chamadas reais e correção automática.
// Limite do provedor (413/429/sem resposta) é contado à parte: não é erro do modelo, é indisponibilidade naquele minuto.
// Não usa números de fora: cada resultado vem de uma resposta conferida aqui (código executado contra testes,
// formato JSON conferido, cor da imagem conferida). Amostra pequena: serve para comparar, não para ranking geral.
//   node ferramentas/avaliar-modelos.mjs [--modelos a,b,c] [--repeticoes 2] [--saida arquivo.json]
// Lê FREELLMAPI_URL e FREELLMAPI_KEY do .env da raiz (a chave nunca é mostrada nem gravada).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = (env.FREELLMAPI_URL || 'http://127.0.0.1:31415').replace(/\/v1\/?$/, '');
const CHAVE = env.FREELLMAPI_KEY;
if (!CHAVE) { console.error('FREELLMAPI_KEY não está no .env.'); process.exit(1); }
const MODELOS = arg('modelos', 'claude-sonnet-4-5,claude-opus-4-5,qwen3.8-27b,gpt-oss-120b,codestral,mistral-code,gemini-3.8-flash,nemotron-3-super-120b,auto').split(',');
const REPETICOES = Number(arg('repeticoes', '1'));
const PAUSA = Number(arg('pausa', '4000')); // entre chamadas: os provedores grátis limitam tokens por minuto
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- imagem de teste: PNG 32x32 vermelho com um quadrado azul no canto ----------
function png(largura, altura, pixel) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const bloco = (tipo, dados) => { const t = Buffer.from(tipo); const len = Buffer.alloc(4); len.writeUInt32BE(dados.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, dados]))); return Buffer.concat([len, t, dados, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4); ihdr[8] = 8; ihdr[9] = 2;
  const linhas = [];
  for (let y = 0; y < altura; y++) { linhas.push(0); for (let x = 0; x < largura; x++) linhas.push(...pixel(x, y)); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(Buffer.from(linhas))), bloco('IEND', Buffer.alloc(0))]);
}
const IMAGEM = `data:image/png;base64,${png(64, 64, (x, y) => (x < 16 && y < 16 ? [20, 60, 220] : [220, 30, 30])).toString('base64')}`;

const blocoDeCodigo = (texto, linguagem) => {
  const blocos = [...texto.matchAll(/```(\w*)\n([\s\S]*?)```/g)];
  const certo = blocos.find((b) => b[1].toLowerCase().startsWith(linguagem)) ?? blocos[0];
  return certo ? certo[2] : texto;
};

// ---------- tarefas ----------
const TAREFAS = [
  {
    id: 'codigo-js', tipo: 'gerar código', mensagens: [{ role: 'user', content: 'Escreva uma função JavaScript `segundoMaior(lista)` que devolve o segundo maior valor DISTINTO de uma lista de números, ou null se não existir. Responda só com o código num bloco ```js.' }],
    corrigir(texto) {
      const codigo = blocoDeCodigo(texto, 'js');
      const casos = [[[3, 1, 4, 1, 5], 4], [[7, 7, 7], null], [[], null], [[-2, -5, -1], -2], [[10, 9], 9], [[2, 2, 1], 1]];
      try {
        const ctx = vm.createContext({});
        vm.runInContext(`${codigo}\n;globalThis.__f = typeof segundoMaior === 'function' ? segundoMaior : null;`, ctx, { timeout: 1000 });
        if (!ctx.__f) return { ok: false, motivo: 'não definiu segundoMaior' };
        const falhas = casos.filter(([e, s]) => { try { return vm.runInContext(`__f(${JSON.stringify(e)})`, ctx, { timeout: 1000 }) !== s; } catch { return true; } });
        return { ok: !falhas.length, motivo: falhas.length ? `${falhas.length}/${casos.length} casos errados` : `${casos.length}/${casos.length} casos` };
      } catch (e) { return { ok: false, motivo: `não rodou: ${e.message.slice(0, 80)}` }; }
    },
  },
  {
    id: 'corrigir-python', tipo: 'corrigir bug', mensagens: [{ role: 'user', content: 'Este código Python tem dois bugs: dá erro com lista vazia e a média sai errada. Corrija e responda só com o código corrigido num bloco ```python.\n\n```python\ndef media(notas):\n    total = 0\n    for i in range(1, len(notas)):\n        total += notas[i]\n    return total / len(notas)\n```' }],
    corrigir(texto) {
      const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-aval-'));
      try {
        const arquivo = path.join(pasta, 't.py');
        writeFileSync(arquivo, `${blocoDeCodigo(texto, 'py')}\n\nassert media([7, 8, 9]) == 8\nassert media([10]) == 10\nassert media([5, 6]) == 5.5\nassert media([]) in (0, 0.0, None)\nprint("ok")\n`);
        const r = spawnSync('python', [arquivo], { encoding: 'utf8', timeout: 10_000 });
        return { ok: r.status === 0 && /ok/.test(r.stdout), motivo: r.status === 0 ? 'testes passaram' : (r.stderr.trim().split('\n').pop() || 'falhou').slice(0, 100) };
      } finally { rmSync(pasta, { recursive: true, force: true }); }
    },
  },
  {
    id: 'tutor', tipo: 'explicar sem dar a resposta', mensagens: [
      { role: 'system', content: 'Você é o Gyde, tutor de programação para iniciantes brasileiros. Responda em português do Brasil, sem emojis.' },
      { role: 'user', content: 'Sou iniciante. Meu código Python dá "IndexError: list index out of range":\n\n```python\nl = [1, 2, 3]\nfor i in range(len(l) + 1):\n    print(l[i])\n```\n\nExplique o que está errado, mas NÃO me dê o código corrigido: quero tentar sozinho.' },
    ],
    corrigir(texto) {
      const portugues = (texto.match(/\b(você|não|que|lista|índice|posição|porque|para)\b/gi) || []).length >= 4;
      const explica = /índice|indice|posição|posicao|len\(l\)|range/i.test(texto);
      const entregou = /for\s+\w+\s+in\s+range\s*\(\s*len\s*\(\s*l\s*\)\s*\)\s*:|for\s+\w+\s+in\s+l\s*:/.test(texto);
      const motivo = [!portugues && 'não está em português', !explica && 'não explica o índice', entregou && 'entregou o código corrigido'].filter(Boolean).join(', ');
      return { ok: portugues && explica && !entregou, motivo: motivo || 'explicou sem entregar' };
    },
  },
  {
    id: 'json-forja', tipo: 'seguir o formato do agente', mensagens: [
      { role: 'system', content: 'Você é um agente de código. Ferramentas: listar {"caminho": ".", "profundidade": 2}, ler {"caminho": "..."}, editar {"caminho": "...", "procurar": "...", "substituir": "..."}, executar {"comando": "..."}.\nRESPONDA SEMPRE com UM objeto JSON e nada mais: {"pensamento": "...", "acoes": [{"ferramenta": "...", "args": {...}}]} para agir, ou {"pensamento": "...", "resposta": "..."} para responder ao usuário.' },
      { role: 'user', content: 'PASTA DO PROJETO: C:\\projeto\nNOVA MENSAGEM DO USUÁRIO: rode os testes do projeto (npm test) e leia o package.json ao mesmo tempo.' },
    ],
    corrigir(texto) {
      const inicio = texto.indexOf('{'), fim = texto.lastIndexOf('}');
      let o; try { o = JSON.parse(texto.slice(inicio, fim + 1)); } catch { return { ok: false, motivo: 'não é JSON' }; }
      const acoes = Array.isArray(o.acoes) ? o.acoes : [];
      const nomes = acoes.map((a) => a.ferramenta);
      const ok = nomes.includes('executar') && nomes.includes('ler') && acoes.some((a) => /npm\s+test/.test(a.args?.comando || '')) && acoes.some((a) => /package\.json/.test(a.args?.caminho || ''));
      return { ok, motivo: ok ? 'duas ações certas no mesmo passo' : `ações: ${nomes.join(', ') || 'nenhuma'}` };
    },
  },
  {
    id: 'visao', tipo: 'ler imagem', mensagens: [{ role: 'user', content: [{ type: 'text', text: 'Qual é a cor que ocupa quase toda a imagem e qual a cor do quadrado pequeno no canto? Responda no formato: fundo=<cor>; quadrado=<cor>, em português.' }, { type: 'image_url', image_url: { url: IMAGEM } }] }],
    corrigir(texto) {
      const fundo = /fundo\s*=\s*vermelh/i.test(texto), quadrado = /quadrado\s*=\s*azul/i.test(texto);
      return { ok: fundo && quadrado, motivo: fundo && quadrado ? 'viu as duas cores' : `resposta: ${texto.slice(0, 60).replace(/\s+/g, ' ')}` };
    },
  },
];

async function chamar(modelo, mensagens) {
  const inicio = Date.now();
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    let r;
    try {
      r = await fetch(`${BASE}/v1/chat/completions`, {
        method: 'POST', signal: AbortSignal.timeout(120_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHAVE}` },
        body: JSON.stringify({ model: modelo, messages: mensagens, max_tokens: 1200, temperature: 0.2 }),
      });
    } catch (e) { return { erro: `sem resposta: ${e.message}`, ms: Date.now() - inicio }; }
    if (r.status === 429) { await espera(20_000); continue; } // limite do minuto: espera e tenta de novo
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { erro: `HTTP ${r.status}: ${(j.error?.message || '').slice(0, 100)}`, ms: Date.now() - inicio };
    return { texto: j.choices?.[0]?.message?.content || '', via: r.headers.get('x-routed-via') || modelo, tokens: j.usage?.total_tokens ?? null, ms: Date.now() - inicio };
  }
  return { erro: 'limite (429) três vezes seguidas', ms: Date.now() - inicio };
}

const resultados = [];
for (const modelo of MODELOS) {
  for (const t of TAREFAS) {
    for (let n = 0; n < REPETICOES; n++) {
      const r = await chamar(modelo, t.mensagens);
      await espera(PAUSA);
      const nota = r.erro ? { ok: false, motivo: r.erro } : r.texto.trim() ? t.corrigir(r.texto) : { ok: false, motivo: 'resposta vazia' };
      resultados.push({ modelo, tarefa: t.id, ok: nota.ok, motivo: nota.motivo, via: r.via ?? null, ms: r.ms, tokens: r.tokens ?? null, erro: Boolean(r.erro) });
      console.log(`${nota.ok ? 'OK   ' : 'FALHA'} ${modelo.padEnd(22)} ${t.id.padEnd(16)} ${String(r.ms).padStart(6)} ms  via ${String(r.via ?? '-').padEnd(28)} ${nota.motivo}`);
    }
  }
}

console.log('\nResumo por modelo (acertos / tentativas, tempo mediano):');
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
for (const modelo of MODELOS) {
  const rs = resultados.filter((r) => r.modelo === modelo);
  const respondidas = rs.filter((r) => !r.erro);
  const porTarefa = TAREFAS.map((t) => { const x = respondidas.filter((r) => r.tarefa === t.id); return `${t.id} ${x.filter((r) => r.ok).length}/${x.length}`; }).join('  ');
  console.log(`${modelo.padEnd(22)} acertou ${respondidas.filter((r) => r.ok).length}/${respondidas.length} respondidas (${rs.length - respondidas.length} sem resposta/limite)  ${mediana(respondidas.map((r) => r.ms))} ms  | ${porTarefa}`);
}
const saida = arg('saida', null);
if (saida) writeFileSync(saida, JSON.stringify({ em: new Date().toISOString(), repeticoes: REPETICOES, modelos: MODELOS, tarefas: TAREFAS.map(({ id, tipo }) => ({ id, tipo })), resultados }, null, 2));
