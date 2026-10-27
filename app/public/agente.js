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
  clipe: '<svg viewBox="0 0 24 24"><path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>',
  arquivos: '<svg viewBox="0 0 24 24"><path d="M4 5h6l2 2h8v12H4z"/><path d="M8 12h8M8 15h5"/></svg>',
  escudo: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M12 8v5M12 16h.01"/></svg>',
  enviar: '<svg class="i-send" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg><svg class="i-stop" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
};
const verbo = { listar: 'Explorando', ler: 'Lendo', buscar: 'Procurando', escrever: 'Escrevendo', editar: 'Editando', apagar: 'Apagando', executar: 'Executando' };
const alvo = (nome, a = {}) => (nome === 'executar' ? a.comando : nome === 'buscar' ? `"${a.texto}"` : !a.caminho || a.caminho === '.' || a.caminho === './' ? 'a pasta do projeto' : a.caminho);
const quando = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
// 75000 -> "1 min 15 s"; 8000 -> "8 s"
export const duracao = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`; };
const tamanho = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const TEXTO_OK = /\.(txt|md|js|mjs|cjs|ts|tsx|jsx|json|py|java|c|cpp|h|cs|go|rs|rb|php|html|css|scss|sql|xml|ya?ml|toml|ini|csv|log|sh|bat|ps1|kt|swift|dart|vue|svelte)$/i;
const relogio = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function createAgentePage({ root, api, toast, renderMarkdown }) {
  let controle = null, timer = null, urlAnexo = () => '';

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
    if (ev.nome === 'escrever' || ev.nome === 'editar' || ev.nome === 'apagar') el.dataset.muda = ev.args?.caminho || '';
    el.innerHTML = `<div class="ag-cab"><span class="ag-ic">${ic[ev.nome === 'apagar' ? 'lixo' : ev.nome] || ic.executar}</span>
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
  // resumo das mudanças reais (vem do servidor, não do texto do modelo)
  function resumoMudancas(m) {
    if (!m) return '';
    const grupo = (rot, cls, itens) => (itens.length ? `<div class="forja-mud ${cls}"><b>${rot}</b>${itens.map((f) => `<code>${esc(f)}</code>`).join('')}</div>` : '');
    const cmds = (m.comandos || []).map((c) => `<code class="${c.ok ? 'ok' : 'falhou'}">${c.ok ? '✓' : '✕'} ${esc(c.comando)}</code>`).join('');
    const corpo = grupo('Criados', 'criados', m.criados || []) + grupo('Alterados', 'alterados', m.modificados || []) + grupo('Apagados', 'apagados', m.apagados || [])
      + (cmds ? `<div class="forja-mud comandos"><b>Comandos</b>${cmds}</div>` : '');
    return corpo ? `<div class="forja-resumo" aria-label="Resumo das mudanças">${corpo}</div>` : '';
  }
  // aplica um evento do servidor na conversa (serve para o histórico e para o ao vivo)
  function adicionar(ev, lista, aoVivo = false) {
    const turno = [...lista.querySelectorAll('.forja-turno')].pop();
    const passos = turno?.querySelector('.forja-passos');
    passos?.querySelector('.ag-pensando')?.remove();
    if (ev.tipo === 'tarefa') {
      const anexos = (ev.anexos || []).map((a) => (a.tipo === 'imagem'
        ? `<a href="${urlAnexo(a)}" target="_blank" rel="noopener" class="forja-anexo-img" title="${esc(a.nome)}"><img src="${urlAnexo(a)}" alt="${esc(a.nome)}" loading="lazy"></a>`
        : `<span class="forja-anexo-arq" title="${esc(a.nome)}">${ic.ler}${esc(a.nome)}</span>`)).join('');
      lista.insertAdjacentHTML('beforeend', `<div class="msg user">${anexos ? `<div class="forja-anexos-msg">${anexos}</div>` : ''}${ev.texto ? `<div class="bubble">${esc(ev.texto)}</div>` : ''}</div>`);
      novoTurno(lista, ev.inicio || ev.em || Date.now());
    } else if (!turno) return;
    else if (ev.tipo === 'pensando') { if (aoVivo) passos.insertAdjacentHTML('beforeend', '<div class="ag-pensando"><i></i><i></i><i></i> pensando</div>'); }
    else if (ev.tipo === 'ferramenta') passos.append(linhaFerramenta(ev));
    else if (ev.tipo === 'resultado') { const ult = [...passos.querySelectorAll('.ag-passo.rodando')].pop(); if (ult) preencherResultado(ult, ev); }
    else if (ev.tipo === 'confirmar') passos.insertAdjacentHTML('beforeend', `<div class="forja-confirmar" data-id="${esc(ev.id)}" role="group" aria-label="Confirmação">
        <span class="forja-confirmar-ic">${ic.escudo}</span>
        <div><b>A Forja quer: ${esc(ev.acao)}</b><small>Precisa da sua autorização porque ${esc(ev.motivo)}.</small></div>
        <div class="forja-confirmar-botoes">${aoVivo ? `<button type="button" class="btn small" data-confirmar="nao">Não permitir</button><button type="button" class="btn primary small" data-confirmar="sim">Permitir</button>` : '<span class="forja-confirmar-estado">sem resposta</span>'}</div></div>`);
    else if (ev.tipo === 'confirmacao') { const c = passos.querySelector(`.forja-confirmar[data-id="${CSS.escape(ev.id)}"]`); if (c) { c.classList.add(ev.aprovado ? 'aprovado' : 'recusado'); c.querySelector('.forja-confirmar-botoes').innerHTML = `<span class="forja-confirmar-estado">${ev.aprovado ? '✓ Permitido' : '✕ Não permitido'}</span>`; } }
    else if (ev.tipo === 'resposta') { turno.querySelector('.forja-resposta').innerHTML = resumoMudancas(ev.mudancas) + renderMarkdown(ev.texto); concluirTurno(turno, ev, ev.em || Date.now()); }
    else if (ev.tipo === 'erro') { turno.querySelector('.forja-resposta').innerHTML = `<p class="msg-error">${esc(ev.texto)}</p>`; concluirTurno(turno, ev, ev.em || Date.now()); }
  }

  async function renderSessao(id) {
    const sessao = await api(`/api/codigo/sessoes/${id}`);
    urlAnexo = (a) => `/api/codigo/sessoes/${id}/anexos/${a.arquivo}`;
    root.innerHTML = `<div class="forja-chat">
      <header class="forja-topo">
        <a class="icon-btn" href="#/agente" title="Projetos" aria-label="Voltar para os projetos">${ic.seta.replace('<svg', '<svg style="transform:scaleX(-1)"')}</a>
        <span class="forja-projeto" title="${esc(sessao.pasta)}">${ic.pasta}<b>${esc(sessao.pasta.split(/[\\/]/).pop())}</b><code>${esc(sessao.pasta)}</code></span>
        <button class="icon-btn" data-act="arquivos" title="Arquivos do projeto que a Forja pode ver" aria-label="Arquivos do projeto" aria-expanded="false">${ic.arquivos}</button>
        <button class="icon-btn" data-act="apagar" title="Apagar esta conversa (os arquivos do projeto ficam)">${ic.lixo}</button>
      </header>
      <div class="forja-arvore" id="agArvore" hidden></div>
      ${sessao.trabalhando ? '<p class="forja-aviso">A Forja ainda está trabalhando nesta conversa (em outra aba ou depois de recarregar). Espere ela terminar para mandar outra mensagem.</p>' : ''}
      <div class="forja-rolagem" id="agRolagem"><div class="messages" id="agLista">
        ${sessao.eventos.length ? '' : `<div class="ag-vazio"><span class="forja-marca grande">${ic.forja}</span><h2>O que vamos construir?</h2><p>A Forja trabalha dentro de <b>${esc(sessao.pasta.split(/[\\/]/).pop())}</b>: lê, escreve, testa e documenta sozinha.</p>
          <div class="ag-sugestoes"><button>Explique como este projeto funciona</button><button>Encontre e corrija bugs</button><button>Crie testes para o código principal</button><button>Escreva um README completo</button></div></div>`}
      </div></div>
      <form class="composer forja-composer" id="agForm">
        <div class="drop-hint">Solte as imagens ou arquivos para anexar</div>
        <div class="forja-anexos" id="agAnexos"></div>
        <div class="composer-row">
          <button type="button" class="icon-btn" data-act="anexar" aria-label="Anexar imagens ou arquivos" title="Anexar imagens (prints, referências) ou arquivos de texto">${ic.clipe}</button>
          <input type="file" id="agArquivo" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.js,.mjs,.ts,.tsx,.jsx,.json,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.html,.css,.sql,.xml,.yml,.yaml,.csv,.log">
          <textarea name="texto" rows="1" placeholder="Peça qualquer coisa para este projeto (cole prints com Ctrl+V)"></textarea>
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
    let anexos = []; // { nome, tipo: 'imagem'|'arquivo', dataUrl|texto, tamanho }
    const caixaAnexos = root.querySelector('#agAnexos');
    const desenharAnexos = () => {
      caixaAnexos.innerHTML = anexos.map((a, i) => `<span class="forja-anexo">${a.tipo === 'imagem' ? `<img src="${a.dataUrl}" alt="">` : ic.ler}<span>${esc(a.nome)}<small>${tamanho(a.tamanho)}</small></span><button type="button" data-tirar="${i}" aria-label="Tirar ${esc(a.nome)}">✕</button></span>`).join('');
    };
    const lerArquivo = (f) => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => falha(r.error); if (f.type.startsWith('image/')) r.readAsDataURL(f); else r.readAsText(f); });
    async function anexar(lista) {
      for (const f of lista) {
        try {
          if (anexos.length >= 8) { toast('No máximo 8 anexos por mensagem.'); break; }
          if (/^image\/(png|jpeg|webp|gif)$/.test(f.type)) {
            if (f.size > 6 * 1048576) { toast(`${f.name}: imagem maior que 6 MB.`); continue; }
            anexos.push({ nome: f.name || 'print.png', tipo: 'imagem', dataUrl: await lerArquivo(f), tamanho: f.size });
          } else if (TEXTO_OK.test(f.name)) {
            if (f.size > 200_000) { toast(`${f.name}: arquivo de texto grande demais (máx. 200 KB).`); continue; }
            anexos.push({ nome: f.name, tipo: 'arquivo', texto: await lerArquivo(f), tamanho: f.size });
          } else toast(`${f.name}: tipo não aceito. Anexe imagens (PNG, JPG, WEBP, GIF) ou arquivos de texto/código.`);
        } catch { toast(`Não consegui ler ${f.name}.`); }
      }
      desenharAnexos();
    }
    root.querySelector('[data-act="anexar"]').onclick = () => root.querySelector('#agArquivo').click();
    root.querySelector('#agArquivo').onchange = (e) => { anexar([...e.target.files]); e.target.value = ''; };
    caixaAnexos.onclick = (e) => { const b = e.target.closest('[data-tirar]'); if (b) { anexos.splice(Number(b.dataset.tirar), 1); desenharAnexos(); } };
    form.texto.addEventListener('paste', (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); anexar(fs); } });
    form.addEventListener('dragover', (e) => { e.preventDefault(); form.classList.add('dragging'); });
    form.addEventListener('dragleave', (e) => { if (!form.contains(e.relatedTarget)) form.classList.remove('dragging'); });
    form.addEventListener('drop', (e) => { e.preventDefault(); form.classList.remove('dragging'); anexar([...(e.dataTransfer?.files || [])]); });
    // confirmar ou recusar uma ação de risco
    lista.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-confirmar]'); if (!b) return;
      const card = b.closest('.forja-confirmar');
      card.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      try { await api(`/api/codigo/sessoes/${id}/confirmar`, { method: 'POST', body: JSON.stringify({ id: card.dataset.id, aprovado: b.dataset.confirmar === 'sim' }) }); } catch (err) { toast(err.message); card.querySelectorAll('button').forEach((x) => { x.disabled = false; }); }
    });
    // árvore de arquivos do projeto
    const arvore = root.querySelector('#agArvore'), botaoArvore = root.querySelector('[data-act="arquivos"]');
    botaoArvore.onclick = async () => {
      const abrir = arvore.hidden; arvore.hidden = !abrir; botaoArvore.setAttribute('aria-expanded', String(abrir));
      if (!abrir) return;
      arvore.innerHTML = '<p class="forja-arvore-info">Carregando…</p>';
      try {
        const r = await api(`/api/codigo/sessoes/${id}/arquivos`);
        arvore.innerHTML = `<p class="forja-arvore-info">A Forja só enxerga esta pasta. Arquivos de senhas e chaves (.env, chaves SSH...) ficam de fora. <a href="#/agente">Trocar de projeto</a></p><pre>${esc(r.arvore)}</pre>`;
      } catch (err) { arvore.innerHTML = `<p class="msg-error">${esc(err.message)}</p>`; }
    };
    const ajustar = () => { form.texto.style.height = 'auto'; form.texto.style.height = `${Math.min(form.texto.scrollHeight, 220)}px`; };
    form.texto.addEventListener('input', ajustar);
    root.querySelectorAll('.ag-sugestoes button').forEach((b) => { b.onclick = () => { form.texto.value = b.textContent; form.requestSubmit(); }; });
    root.querySelector('[data-act="apagar"]').onclick = async () => { if (!confirm('Apagar esta conversa? Os arquivos do projeto não são apagados.')) return; await api(`/api/codigo/sessoes/${id}`, { method: 'DELETE' }); location.hash = '#/agente'; };
    form.texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (controle) { controle.abort(); return; } // o botão vira "parar" enquanto trabalha
      const texto = form.texto.value.trim(); if (!texto && !anexos.length) return;
      const enviar = anexos.map(({ nome, tipo, dataUrl, texto: conteudo }) => ({ nome, tipo, dataUrl, texto: conteudo }));
      form.texto.value = ''; ajustar(); anexos = []; desenharAnexos(); lista.querySelector('.ag-vazio')?.remove();
      envio.classList.add('streaming'); envio.setAttribute('aria-label', 'Parar');
      controle = new AbortController();
      clearInterval(timer);
      timer = setInterval(() => { const t = lista.querySelector('.forja-turno.trabalhando'); if (t) t.querySelector('.forja-tempo').textContent = relogio(Date.now() - Number(t.dataset.inicio)); }, 500);
      try {
        const res = await fetch(`/api/codigo/sessoes/${id}/tarefa`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1' }, body: JSON.stringify({ texto, anexos: enviar }), signal: controle.signal });
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
        const ev = { tipo: 'erro', texto: err.name === 'AbortError' ? 'Parado por você.' : err instanceof TypeError ? 'Sem conexão com o servidor do Gyde. Confira se a janela do iniciar.bat está aberta.' : err.message };
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
