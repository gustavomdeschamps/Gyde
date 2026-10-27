// Provedores de IA do Gyde: online (FreeLLMAPI) ou offline (Ollama, modelo rodando no próprio computador).
// Todos os módulos chamam `router(caminho, init)` no formato da API da OpenAI; aqui se decide para onde vai.
// Também guarda o consumo REAL informado pelo provedor (cabeçalhos e campo usage). Nada é estimado aqui.

const SEGUNDO = 1000;

export function criarProvedores({ routerUrl, routerKey, ollamaUrl, ollamaModelo, modo, uso }) {
  // modo: 'online' (só FreeLLMAPI), 'offline' (só Ollama) ou 'auto' (FreeLLMAPI; se ele não responder, Ollama)
  const cfg = { modo: ['online', 'offline', 'auto'].includes(modo) ? modo : 'auto' };
  const saude = { online: null, offline: null, em: 0, modelosLocais: [] };
  const ultimo = { limite: null };
  let usoMes = { dados: null, em: 0 };

  async function checar() {
    if (Date.now() - saude.em < 15 * SEGUNDO) return saude;
    const tenta = async (url, init) => { try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(2500) }); return r.ok ? r : null; } catch { return null; } };
    const [on, off] = await Promise.all([
      tenta(`${routerUrl}/health`),
      tenta(`${ollamaUrl}/api/tags`),
    ]);
    saude.online = Boolean(on && routerKey);
    saude.modelosLocais = off ? ((await off.json().catch(() => ({}))).models || []).map((m) => m.name) : [];
    saude.offline = saude.modelosLocais.includes(ollamaModelo);
    saude.em = Date.now();
    return saude;
  }

  // Qual provedor atende agora.
  async function ativo() {
    if (cfg.modo === 'online') return 'online';
    if (cfg.modo === 'offline') return 'offline';
    const s = await checar();
    return s.online || !s.offline ? 'online' : 'offline';
  }

  function registrar(res, provedor) {
    const h = (n) => res.headers.get(n);
    if (provedor === 'online' && h('x-ratelimit-limit')) {
      const reset = Number(h('x-ratelimit-reset'));
      ultimo.limite = { total: Number(h('x-ratelimit-limit')), restante: Number(h('x-ratelimit-remaining')), renovaEm: reset ? new Date(reset * 1000).toISOString() : null };
    }
  }

  // `init.registro` (uso.js) recebe cada ida ao provedor; chamadas sem dono (títulos, memória) viram registro "interno".
  async function router(pathname, { registro, ...init } = {}) {
    const avulso = !registro && uso && /completions|images/.test(pathname) ? uso.iniciar(null, 'interno') : null;
    const reg = registro || avulso;
    try {
      const res = await chamar(pathname, init, reg);
      avulso?.fim('ok');
      return res;
    } catch (err) {
      avulso?.fim(uso.resultadoDe(err), err.message);
      throw err;
    }
  }

  async function chamar(pathname, init, reg) {
    const provedor = await ativo();
    const offline = provedor === 'offline';
    if (!offline && !routerKey) {
      throw Object.assign(new Error('Chave do FreeLLMAPI não configurada. Rode o configurar\\configurar-chave.bat.'), { status: 503 });
    }
    let body = init.body;
    if (offline && body) { // no modo offline qualquer modelo pedido vira o modelo local
      const j = JSON.parse(body);
      j.model = ollamaModelo;
      if (j.stream) j.stream_options = { include_usage: true };
      body = JSON.stringify(j);
    } else if (body) {
      const j = JSON.parse(body);
      if (j.stream) { j.stream_options = { include_usage: true }; body = JSON.stringify(j); }
    }
    const base = offline ? `${ollamaUrl}/v1` : routerUrl;
    const caminho = offline ? pathname.replace(/^\/v1/, '') : pathname;
    let res;
    try {
      res = await fetch(base + caminho, {
        ...init,
        body,
        headers: { 'Content-Type': 'application/json', ...(offline ? {} : { Authorization: `Bearer ${routerKey}` }), ...init.headers },
      });
    } catch (cause) {
      reg?.chamada({ provedor, ok: false });
      if (cause.name === 'AbortError') throw cause;
      saude.em = 0; // força nova checagem: pode ter caído a internet ou o programa
      const msg = offline
        ? 'Não consegui falar com o Ollama (o modelo local). Abra o Ollama e tente de novo.'
        : 'Não consegui falar com o FreeLLMAPI. Ele está aberto na bandeja do Windows?';
      throw Object.assign(new Error(msg), { status: 502, final: offline });
    }
    registrar(res, provedor);
    reg?.chamada({ provedor, ok: res.ok, modelo: offline ? ollamaModelo : res.headers.get('x-routed-via') });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.error?.message || j.message || ''; } catch { /* corpo vazio */ }
      // 429 do roteador inteiro (acabaram os pedidos do minuto) para tudo; 429 de um modelo só deixa tentar outro
      if (res.status === 429 && ultimo.limite?.restante === 0) {
        throw Object.assign(new Error(await mensagemLimite()), { status: 429, limite: 'roteador-minuto' });
      }
      const err = new Error(offline ? `O modelo local respondeu ${res.status}${detail ? `: ${detail}` : ''}` : `FreeLLMAPI respondeu ${res.status}${detail ? `: ${detail}` : ''}`);
      err.status = res.status === 401 ? 401 : 502;
      err.final = offline;
      throw err;
    }
    return res;
  }

  // Mensagem quando o limite por minuto do FreeLLMAPI acaba: qual limite, quem limita, quando volta e o que funciona.
  async function mensagemLimite() {
    const l = ultimo.limite;
    const volta = l?.renovaEm ? `Ele renova às ${new Date(l.renovaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (informado pelo FreeLLMAPI).` : 'O FreeLLMAPI não informou quando renova.';
    const s = await checar();
    const alternativa = s.offline
      ? ` Enquanto isso, dá para usar o modelo local (${ollamaModelo}, mais simples e sem internet): Configurações > IA e modelos > modo "Só offline".`
      : ' Espere a renovação e tente de novo.';
    return `Limite atingido: os ${l?.total ?? ''} pedidos por minuto do FreeLLMAPI acabaram. ${volta}${alternativa}`.replace('os  pedidos', 'os pedidos');
  }

  // Tokens de uma resposta (campo usage da API, quando o provedor manda).
  const tokensDe = (usage) => (usage ? { entrada: usage.prompt_tokens ?? null, saida: usage.completion_tokens ?? null, total: usage.total_tokens ?? null } : null);

  // Resumo para a tela: só dados que o provedor informou de verdade.
  // mostrarConta=false (modo público) esconde o consumo do mês, que é da conta do dono do FreeLLMAPI.
  async function resumo({ mostrarConta = true } = {}) {
    const s = await checar();
    const agora = await ativo();
    let mes = null;
    if (mostrarConta && agora === 'online' && s.online) {
      if (Date.now() - usoMes.em > 30 * SEGUNDO) {
        try {
          const r = await fetch(`${routerUrl}/v1/usage`, { headers: { Authorization: `Bearer ${routerKey}` }, signal: AbortSignal.timeout(3000) });
          if (r.ok) {
            const u = await r.json();
            const caps = (u.byKey || []).filter((k) => k.enabled).map((k) => ({ provedor: k.platform, pedidos: k.requests, tokens: k.tokens, limitePedidos: k.requestCap, limiteTokens: k.tokenCap }));
            usoMes = { dados: { mes: u.month, renovaEm: u.resetsAt, pedidos: u.requests, tokens: u.tokens, porChave: caps }, em: Date.now() };
          }
        } catch { /* fica sem o dado */ }
      }
      mes = usoMes.dados;
    }
    return {
      modo: cfg.modo,
      ativo: agora,
      online: { disponivel: s.online, url: routerUrl },
      offline: { disponivel: s.offline, modelo: ollamaModelo, instalados: s.modelosLocais },
      gratis: true,
      limiteRoteador: agora === 'online' ? ultimo.limite : null,
      mes,
    };
  }

  return {
    router, resumo, ativo, tokensDe,
    definirModo(m) { if (['online', 'offline', 'auto'].includes(m)) { cfg.modo = m; saude.em = 0; } return cfg.modo; },
  };
}
