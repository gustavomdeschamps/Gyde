// Página da Forja (agente de código): um chat ligado à pasta de um projeto. Cada resposta mostra quanto tempo
// a Forja trabalhou e, num bloco que abre e fecha, tudo o que ela fez (arquivos lidos, editados, comandos e testes).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = {
  pasta: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
  listar: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h13"/></svg>',
  ler: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  buscar: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  escrever: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>',
  executar: '<svg viewBox="0 0 24 24"><path d="M4 6l6 6-6 6M12 19h8"/></svg>',
  lixo: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  forja: '<svg viewBox="0 0 24 24"><path d="M4 9h11l3-3h2v5h-2l-1 2H8z"/><path d="M9 13v3M14 13v3M6 20h12"/></svg>',
  seta: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  enviar: '<svg class="i-send" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg><svg class="i-stop" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
};
const verbo = { listar: 'Explorando', ler: 'Lendo', buscar: 'Procurando', escrever: 'Criando', editar: 'Editando', executar: 'Executando' };
const alvo = (nome, a = {}) => (nome === 'executar' ? a.comando : nome === 'buscar' ? `"${a.texto}"` : a.caminho || '.');
const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
// 75000 -> "1 min 15 s"; 8000 -> "8 s"
export const duracao = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`; };
const relogio = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function createAgentePage({ root, api, toast, renderMarkdown }) {
  let controle = null, timer = null;

  async function renderHome() {
    const { sessoes, pessoal } = await api('/api/codigo/sessoes').catch((e) => ({ sessoes: [], erro: e.message }));
    root.innerHTML = `<div class="skills-inner">
      <header class="skills-hero"><div><h1>Forja</h1>
        <p>O agente de código do Gyde. É um chat ligado à pasta de um projeto: você pede, e a Forja faz como um desenvolvedor de verdade, escrevendo o código, testando, corrigindo e documentando, sozinha. Você acompanha cada passo e quanto tempo ela levou.</p></div></header>
      ${pessoal === false ? '<p class="msg-error">A Forja só funciona com o Gyde rodando no seu computador.</p>' : ''}
      <button type="button" class="agente-escolher" id="escolher">
        <span class="agente-escolher-ic">${ic.pasta}</span>
        <span><b>Abrir pasta do projeto</b><small>Abre o Explorador de Arquivos para você escolher a pasta</small></span>
      </button>
      ${sessoes.length ? `<h2 class="section-title">Projetos recentes</h2><div class="agente-sessoes">${sessoes.map((s, i) => `
        <a class="agente-sessao" href="#/agente/${s.id}" style="--i:${i}">${ic.pasta}<span><b>${esc(s.titulo)}</b><small>${esc(s.pasta)}</small></span><time>${quando(s.updated_at)}</time></a>`).join('')}</div>` : ''}
    </div>`;
    const botao = root.querySelector('#escolher');
    botao.onclick = async () => {
      botao.disabled = true; botao.classList.add('esperando');
      try {
        const { pasta } = await api('/api/codigo/escolher-pasta', { method: 'POST' });
        if (!pasta) return; // cancelou a janela
        const r = await api('/api/codigo/sessoes', { method: 'POST', body: JSON.stringify({ pasta }) });
        location.hash = `#/agente/${r.id}`;
      } catch (err) { toast(err.message); } finally { botao.disabled = false; botao.classList.remove('esperando'); }
    };
  }

  // ---------- um turno da Forja: cabeçalho com tempo, atividade (abre/fecha) e resposta ----------
  function novoTurno(lista, inicio) {
    const el = document.createElement('div');
    el.className = 'msg assistant forja-turno trabalhando';
    el.innerHTML = `<button type="button" class="forja-cab" aria-expanded="true">
        <span class="forja-marca">${ic.forja}</span>
        <span class="forja-status"><b>Trabalhando</b> <span class="forja-tempo">0:00</span></span>
        <span class="forja-chips"></span><span class="forja-seta">${ic.seta}</span>
      </button>
      <div class="forja-atividade"><div class="forja-passos"></div></div>
      <div class="forja-resposta md"></div>`;
    el.querySelector('.forja-cab').onclick = () => {
      const aberto = el.classList.toggle('fechado') === false;
      el.querySelector('.forja-cab').setAttribute('aria-expanded', String(aberto));
    };
    el.dataset.inicio = inicio;
    lista.append(el);
    return el;
  }
  function concluirTurno(el, ev, fimMs) {
    el.classList.remove('trabalhando');
    const ms = ev.duracao_ms ?? (fimMs - Number(el.dataset.inicio || fimMs));
    const parado = ev.tipo === 'erro';
    el.querySelector('.forja-status').innerHTML = `<b>${parado ? (ev.texto === 'Parado por você.' ? 'Parado' : 'Não terminou') : 'Trabalhou'}</b> por ${duracao(ms)}`;
    const nArq = ev.arquivos?.length ?? new Set([...el.querySelectorAll('.ag-passo.ok[data-muda]')].map((p) => p.dataset.muda)).size;
    const nCmd = ev.comandos ?? el.querySelectorAll('.ag-passo[data-nome="executar"]').length;
    const nPassos = el.querySelectorAll('.ag-passo').length;
    el.querySelector('.forja-chips').innerHTML = [
      nPassos ? `<span>${nPassos} ${nPassos === 1 ? 'ação' : 'ações'}</span>` : '',
      nArq ? `<span>${nArq} ${nArq === 1 ? 'arquivo alterado' : 'arquivos alterados'}</span>` : '',
      nCmd ? `<span>${nCmd} ${nCmd === 1 ? 'comando' : 'comandos'}</span>` : '',
    ].join('');
    if (!nPassos) el.classList.add('sem-atividade');
    el.classList.add('fechado'); el.querySelector('.forja-cab').setAttribute('aria-expanded', 'false');
    el.querySelector('.forja-passos .ag-pensando')?.remove();
  }
  function linhaFerramenta(ev) {
    const el = document.createElement('div');
    el.className = 'ag-passo rodando'; el.dataset.nome = ev.nome;
    if (ev.nome === 'escrever' || ev.nome === 'editar') el.dataset.muda = ev.args?.caminho || '';
    el.innerHTML = `<div class="ag-cab"><span class="ag-ic">${ic[ev.nome] || ic.executar}</span>
      <span class="ag-tit"><b>${verbo[ev.nome] || ev.nome}</b> <code>${esc(alvo(ev.nome, ev.args))}</code></span><span class="ag-estado"></span></div>
      ${ev.pensamento ? `<p class="ag-pens">${esc(ev.pensamento)}</p>` : ''}`;
    return el;
  }
  function preencherResultado(el, ev) {
    el.classList.remove('rodando'); el.classList.add(ev.ok ? 'ok' : 'falhou');
    el.querySelector('.ag-estado').textContent = ev.ok ? '✓' : '✕';
    let corpo = '';
    if (ev.diff?.antes !== undefined) {
      const linhas = (t, cls, sinal) => String(t).split('\n').map((l) => `<span class="${cls}">${sinal} ${esc(l)}</span>`).join('');
      corpo = `<details><summary>Ver a mudança</summary><pre class="ag-diff">${linhas(ev.diff.antes, 'menos', '-')}${linhas(ev.diff.depois, 'mais', '+')}</pre></details>`;
    } else if (ev.diff?.novo !== undefined) {
      corpo = `<details><summary>${ev.diff.criado ? 'Arquivo criado' : 'Arquivo reescrito'}</summary><pre class="ag-diff">${String(ev.diff.novo).split('\n').map((l) => `<span class="mais">+ ${esc(l)}</span>`).join('')}</pre></details>`;
    } else {
      corpo = `<details${ev.ok ? '' : ' open'}><summary>${esc(ev.resumo || (ev.ok ? 'Pronto' : 'Falhou'))}</summary><pre class="ag-saida">${esc(ev.saida)}</pre></details>`;
    }
    el.insertAdjacentHTML('beforeend', corpo);
  }
  // aplica um evento do servidor na conversa (serve para o histórico e para o ao vivo)
  function adicionar(ev, lista, aoVivo = false) {
    const turno = [...lista.querySelectorAll('.forja-turno')].pop();
    const passos = turno?.querySelector('.forja-passos');
    passos?.querySelector('.ag-pensando')?.remove();
    if (ev.tipo === 'tarefa') {
      lista.insertAdjacentHTML('beforeend', `<div class="msg user"><div class="bubble">${esc(ev.texto)}</div></div>`);
      novoTurno(lista, ev.inicio || ev.em || Date.now());
    } else if (!turno) return;
    else if (ev.tipo === 'pensando') { if (aoVivo) passos.insertAdjacentHTML('beforeend', '<div class="ag-pensando"><i></i><i></i><i></i> pensando</div>'); }
    else if (ev.tipo === 'ferramenta') passos.append(linhaFerramenta(ev));
    else if (ev.tipo === 'resultado') { const ult = [...passos.querySelectorAll('.ag-passo.rodando')].pop(); if (ult) preencherResultado(ult, ev); }
    else if (ev.tipo === 'resposta') { turno.querySelector('.forja-resposta').innerHTML = renderMarkdown(ev.texto); concluirTurno(turno, ev, ev.em || Date.now()); }
    else if (ev.tipo === 'erro') { turno.querySelector('.forja-resposta').innerHTML = `<p class="msg-error">${esc(ev.texto)}</p>`; concluirTurno(turno, ev, ev.em || Date.now()); }
  }

  async function renderSessao(id) {
    const sessao = await api(`/api/codigo/sessoes/${id}`);
    root.innerHTML = `<div class="forja-chat">
      <header class="forja-topo">
        <a class="icon-btn" href="#/agente" title="Projetos" aria-label="Voltar para os projetos">${ic.seta.replace('<svg', '<svg style="transform:scaleX(-1)"')}</a>
        <span class="forja-projeto" title="${esc(sessao.pasta)}">${ic.pasta}<b>${esc(sessao.pasta.split(/[\\/]/).pop())}</b><code>${esc(sessao.pasta)}</code></span>
        <button class="icon-btn" data-act="apagar" title="Apagar esta conversa (os arquivos do projeto ficam)">${ic.lixo}</button>
      </header>
      <div class="forja-rolagem" id="agRolagem"><div class="messages" id="agLista">
        ${sessao.eventos.length ? '' : `<div class="ag-vazio"><span class="forja-marca grande">${ic.forja}</span><h2>O que vamos construir?</h2><p>A Forja trabalha dentro de <b>${esc(sessao.pasta.split(/[\\/]/).pop())}</b>: lê, escreve, testa e documenta sozinha.</p>
          <div class="ag-sugestoes"><button>Explique como este projeto funciona</button><button>Encontre e corrija bugs</button><button>Crie testes para o código principal</button><button>Escreva um README completo</button></div></div>`}
      </div></div>
      <form class="composer forja-composer" id="agForm">
        <div class="composer-row">
          <textarea name="texto" rows="1" placeholder="Peça qualquer coisa para este projeto" required></textarea>
          <button type="submit" class="send" aria-label="Enviar">${ic.enviar}</button>
        </div>
      </form>
    </div>`;
    const lista = root.querySelector('#agLista'), rolagem = root.querySelector('#agRolagem');
    const descer = () => { rolagem.scrollTop = rolagem.scrollHeight; };
    sessao.eventos.forEach((ev) => adicionar(ev, lista));
    // turno sem fim no histórico (servidor reiniciado no meio): fecha com o tempo que se sabe
    lista.querySelectorAll('.forja-turno.trabalhando').forEach((t) => concluirTurno(t, { tipo: 'erro', texto: 'Interrompido' }, sessao.updated_at));
    lista.querySelectorAll('.ag-passo.rodando').forEach((el) => { el.classList.remove('rodando'); el.querySelector('.ag-estado').textContent = '•'; });
    descer();
    const form = root.querySelector('#agForm'), envio = form.querySelector('.send');
    const ajustar = () => { form.texto.style.height = 'auto'; form.texto.style.height = `${Math.min(form.texto.scrollHeight, 220)}px`; };
    form.texto.addEventListener('input', ajustar);
    root.querySelectorAll('.ag-sugestoes button').forEach((b) => { b.onclick = () => { form.texto.value = b.textContent; form.requestSubmit(); }; });
    root.querySelector('[data-act="apagar"]').onclick = async () => { if (!confirm('Apagar esta conversa? Os arquivos do projeto não são apagados.')) return; await api(`/api/codigo/sessoes/${id}`, { method: 'DELETE' }); location.hash = '#/agente'; };
    form.texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (controle) { controle.abort(); return; } // o botão vira "parar" enquanto trabalha
      const texto = form.texto.value.trim(); if (!texto) return;
      form.texto.value = ''; ajustar(); lista.querySelector('.ag-vazio')?.remove();
      envio.classList.add('streaming'); envio.setAttribute('aria-label', 'Parar');
      controle = new AbortController();
      clearInterval(timer);
      timer = setInterval(() => { const t = lista.querySelector('.forja-turno.trabalhando'); if (t) t.querySelector('.forja-tempo').textContent = relogio(Date.now() - Number(t.dataset.inicio)); }, 500);
      try {
        const res = await fetch(`/api/codigo/sessoes/${id}/tarefa`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1' }, body: JSON.stringify({ texto }), signal: controle.signal });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erro ${res.status}`);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += value; let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const linha = buf.slice(0, i); buf = buf.slice(i + 2);
            if (!linha.startsWith('data: ')) continue;
            const ev = JSON.parse(linha.slice(6));
            if (ev.tipo === 'tarefa') ev.inicio = Date.now(); // relógio do navegador para o contador ao vivo
            if (ev.tipo !== 'fim') adicionar(ev, lista, true);
            descer();
          }
        }
      } catch (err) {
        const turno = lista.querySelector('.forja-turno.trabalhando');
        const ev = { tipo: 'erro', texto: err.name === 'AbortError' ? 'Parado por você.' : err.message };
        if (turno) adicionar(ev, lista); else lista.insertAdjacentHTML('beforeend', `<p class="msg-error">${esc(ev.texto)}</p>`);
      }
      lista.querySelectorAll('.forja-turno.trabalhando').forEach((t) => concluirTurno(t, { tipo: 'erro', texto: 'Interrompido' }, Date.now()));
      clearInterval(timer); controle = null;
      envio.classList.remove('streaming'); envio.setAttribute('aria-label', 'Enviar'); form.texto.focus(); descer();
    };
    form.texto.focus();
  }

  return {
    async show(id) {
      if (controle) return; // trabalhando: não troca a tela no meio
      clearInterval(timer);
      try { if (id) await renderSessao(id); else await renderHome(); } catch (err) { root.innerHTML = `<div class="skills-inner"><p class="msg-error">${esc(err.message)}</p></div>`; }
    },
    ocupado: () => Boolean(controle),
  };
}
