// FreeLLMAPI falso para os testes: responde como a API da OpenAI, sem internet e sempre igual.
// - chat (streaming): "Resposta de teste: <pergunta>"; pergunta com LONGA gera uma resposta comprida e lenta (para testar o Parar)
// - títulos e tarefas internas (sem streaming): "Conversa de teste"
// - Forja: roteiro fixo. Tarefa com LONGA roda um comando demorado; SOBRESCREVER testa as travas de escrita e a cobrança
//   de testes; as outras leem soma.js, corrigem e rodam npm test.
import http from 'node:http';
import { portaLivre } from './ajuda.mjs';

const MODELO = 'falso/modelo-de-teste';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p.text ?? '').join(' ') : '');

function forja(mensagens) {
  const tarefa = textoDe(mensagens.find((m) => m.role === 'user')?.content);
  const passo = mensagens.filter((m) => m.role === 'assistant').length;
  if (/LONGA/.test(tarefa)) {
    return passo === 0
      ? { pensamento: 'Vou rodar o comando pedido.', acoes: [{ ferramenta: 'executar', args: { comando: 'node -e "setTimeout(() => {}, 60000)"' } }] }
      : { pensamento: 'Terminei.', resposta: '**O que fiz**\nRodei o comando.' };
  }
  // SOBRESCREVER: tenta substituir sem ler, depois regravar com o segredo apagado, edita e tenta terminar sem testar
  if (/SOBRESCREVER/.test(tarefa)) {
    const roteiro = [
      { pensamento: 'Reescrevo direto.', acoes: [{ ferramenta: 'escrever', args: { caminho: 'soma.js', conteudo: 'function soma(a, b) {\n  return a + b;\n}\nmodule.exports = { soma };\n' } }] },
      { pensamento: 'Leio antes.', acoes: [{ ferramenta: 'ler', args: { caminho: 'soma.js' } }] },
      { pensamento: 'Reescrevo com o que li.', acoes: [{ ferramenta: 'escrever', args: { caminho: 'soma.js', conteudo: '// chave antiga: [segredo removido]\nfunction soma(a, b) {\n  return a + b;\n}\nmodule.exports = { soma };\n' } }] },
      { pensamento: 'Edito só o trecho.', acoes: [{ ferramenta: 'editar', args: { caminho: 'soma.js', procurar: 'a - b', substituir: 'a + b' } }] },
      { pensamento: 'Pronto.', resposta: 'Corrigi.' },
      { pensamento: 'Rodo os testes.', acoes: [{ ferramenta: 'executar', args: { comando: 'npm test' } }] },
      { pensamento: 'Testes passaram.', resposta: '**O que fiz**\nCorrigi a soma e rodei os testes.' },
    ];
    return roteiro[Math.min(passo, roteiro.length - 1)];
  }
  if (passo === 0) return { pensamento: 'Primeiro leio o arquivo.', acoes: [{ ferramenta: 'ler', args: { caminho: 'soma.js' } }] };
  if (passo === 1) return { pensamento: 'A função subtrai; corrijo e rodo os testes.', acoes: [
    { ferramenta: 'editar', args: { caminho: 'soma.js', procurar: 'a - b', substituir: 'a + b' } },
    { ferramenta: 'executar', args: { comando: 'npm test' } }] };
  return { pensamento: 'Testes passaram.', resposta: '**O que fiz**\nCorrigi a soma.\n\n**Arquivos**\n- soma.js: trocava - por +\n\n**Testes**\nnpm test passou.' };
}

export async function provedorFalso() {
  const pedidos = [];
  const porta = await portaLivre();
  const servidor = http.createServer(async (req, res) => {
    const json = (status, corpo) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corpo)); };
    if (req.url === '/health') return json(200, { ok: true });
    if (req.url?.startsWith('/v1/models')) return json(200, { data: ['qwen3.8-27b', 'codestral', 'mistral-code'].map((id) => ({ id })) });
    if (req.url?.startsWith('/v1/usage')) return json(200, {});
    if (req.method !== 'POST' || !req.url?.startsWith('/v1/chat/completions')) return json(404, { error: { message: 'rota falsa inexistente' } });
    let bruto = '';
    for await (const pedaco of req) bruto += pedaco;
    const corpo = JSON.parse(bruto);
    const mensagens = corpo.messages ?? [];
    pedidos.push({ modelo: corpo.model, stream: Boolean(corpo.stream), mensagens });
    const usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 };

    if (/Você é a Forja/.test(textoDe(mensagens[0]?.content))) {
      return json(200, { model: MODELO, usage, choices: [{ message: { role: 'assistant', content: JSON.stringify(forja(mensagens)) } }] });
    }
    const pergunta = textoDe(mensagens.filter((m) => m.role === 'user').at(-1)?.content).trim();
    if (!corpo.stream) return json(200, { model: MODELO, usage, choices: [{ message: { role: 'assistant', content: 'Conversa de teste' } }] });

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    const enviar = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    const pedacos = /LONGA/.test(pergunta)
      ? Array.from({ length: 300 }, (_, i) => `${i + 1}. Linha comprida de teste para dar tempo de parar.\n`)
      : ['Resposta ', 'de teste: ', pergunta.slice(0, 200)];
    let fechou = false;
    req.on('close', () => { fechou = true; });
    for (const p of pedacos) {
      if (fechou) return;
      enviar({ model: MODELO, choices: [{ delta: { content: p } }] });
      await espera(/LONGA/.test(pergunta) ? 40 : 5);
    }
    enviar({ model: MODELO, usage, choices: [] });
    res.end('data: [DONE]\n\n');
  });
  await new Promise((r) => servidor.listen(porta, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${porta}`, pedidos, fechar: () => new Promise((r) => { servidor.closeAllConnections(); servidor.close(r); }) };
}
