// Página de Skills: catálogo de habilidades instaláveis, skills próprias, loja da comunidade,
// importar e exportar.

const SYMBOLS = ['◆', '★', '●', '▲', '■', '◎', '⊞', '¶', '§', '∑', 'λ', 'π', 'Ω', '∞', '≡', '⌘', '⎇', '↻', '→', '✓', '!', '?', '#', '@', '</>', '{ }', '.*', '$_'];

const ic = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  store: '<svg viewBox="0 0 24 24"><path d="M4 9.5L5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg>',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TABS = [['todas', 'Todas'], ['instaladas', 'Instaladas'], ['minhas', 'Minhas'], ['loja', 'Loja']];

export function createSkillsPage({ root, api, toast, renderMarkdown, onChange }) {
  let skills = [];
  let loja = [];
  let filter = 'todas';
  let busca = '';

  async function load() {
    ({ skills } = await api('/api/skills'));
    publish();
  }
  async function loadLoja() {
    ({ loja } = await api('/api/skills/loja'));
  }
  function publish() {
    onChange(skills.filter((s) => s.instalada));
    const n = skills.filter((s) => s.instalada).length;
    const badge = document.getElementById('skillsBadge');
    if (badge) badge.textContent = n ? String(n) : '';
  }

  async function toggle(id, on) {
    ({ skills } = await api(`/api/skills/${id}/install`, { method: on ? 'POST' : 'DELETE' }));
    publish();
    const s = skills.find((x) => x.id === id);
    toast(on ? `Skill "${s.nome}" instalada${s.comando ? ` — use ${s.comando}` : ''}` : `Skill "${s.nome}" removida`);
  }

  const count = (f) => (f === 'loja' ? loja.length
    : skills.filter((s) => f === 'todas' || (f === 'instaladas' ? s.instalada : s.origem === 'minha')).length);
  const origemLabel = (s) => (s.loja ? 'Da loja' : s.origem === 'minha' ? (s.publicada ? 'Minha · na loja' : 'Minha skill') : esc(s.categoria));

  function card(s, i) {
    return `<article class="skill-card${s.instalada ? ' on' : ''}" style="--i:${i}" data-id="${esc(s.id)}">
      <div class="skill-top">
        <span class="skill-symbol" aria-hidden="true">${esc(s.simbolo)}</span>
        <span class="skill-cat">${origemLabel(s)}</span>
      </div>
      <h2><a href="#/skills/${esc(s.id)}">${esc(s.nome)}</a></h2>
      <p>${esc(s.descricao)}</p>
      <div class="skill-foot">
        ${s.comando ? `<code class="cmd">${esc(s.comando)}</code>` : '<span></span>'}
        <button class="btn ${s.instalada ? 'installed' : 'primary'} small" data-act="toggle">${s.instalada ? `${ic.check}Instalada` : `${ic.plus}Instalar`}</button>
      </div>
    </article>`;
  }

  function lojaCard(s, i) {
    const n = `${s.installs} ${s.installs === 1 ? 'instalação' : 'instalações'}`;
    return `<article class="skill-card loja-card${s.instalada ? ' on' : ''}" style="--i:${i}" data-loja="${esc(s.id)}">
      <div class="skill-top">
        <span class="skill-symbol" aria-hidden="true">${esc(s.simbolo)}</span>
        <span class="skill-cat">${n}</span>
      </div>
      <h2><button type="button" class="link-btn" data-act="ver">${esc(s.nome)}</button></h2>
      <p>${esc(s.descricao)}</p>
      <span class="loja-autor">${ic.user}${s.minha ? 'Você publicou' : esc(s.autor)}</span>
      <div class="skill-foot">
        ${s.comando ? `<code class="cmd">${esc(s.comando)}</code>` : '<span></span>'}
        ${s.minha ? '<button class="btn small danger" data-act="despublicar">Tirar da loja</button>'
          : s.instalada ? `<span class="btn installed small">${ic.check}Instalada</span>`
          : `<button class="btn primary small" data-act="ver">${ic.plus}Ver e instalar</button>`}
      </div>
    </article>`;
  }

  function hero() {
    return `<header class="skills-hero">
        <div><h1>Skills</h1>
          <p>Habilidades que você instala no Gyde. Cada skill ensina um jeito especializado de ajudar e entra em ação pelo <b>comando</b> (como <code>/revisar</code>) ou sozinha, quando sua mensagem tiver as palavras certas. Na <b>Loja</b> ficam as skills que outras pessoas publicaram.</p></div>
        <div class="hero-actions">
          <button class="btn" data-act="import">${ic.upload}Importar .md</button>
          <button class="btn primary" data-act="create">${ic.plus}Criar skill</button>
          <input type="file" accept=".md,text/markdown,text/plain" hidden id="skillFile">
        </div>
      </header>
      <div class="tabs" role="tablist">
        ${TABS.map(([k, l]) => `<button role="tab" class="tab${filter === k ? ' active' : ''}" aria-selected="${filter === k}" data-filter="${k}">${k === 'loja' ? ic.store : ''}${l}<span>${count(k)}</span></button>`).join('')}
      </div>`;
  }

  // Abas, criar e importar: iguais em todas as listas.
  function bindHero() {
    root.querySelectorAll('[data-filter]').forEach((b) => {
      b.onclick = async () => {
        filter = b.dataset.filter;
        if (filter === 'loja') await loadLoja().catch((e) => toast(e.message));
        renderList();
      };
    });
    root.querySelectorAll('[data-act="create"]').forEach((b) => { b.onclick = () => openEditor(); });
    const file = root.querySelector('#skillFile');
    root.querySelector('[data-act="import"]').onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      try {
        const r = await api('/api/skills/import', { method: 'POST', body: JSON.stringify({ markdown: await f.text() }) });
        skills = r.skills;
        publish();
        toast('Skill importada e instalada');
        filter = 'minhas';
        renderList();
      } catch (err) { toast(err.message); }
    };
  }

  function renderList() {
    if (filter === 'loja') return renderLoja();
    const list = skills.filter((s) => filter === 'todas' || (filter === 'instaladas' ? s.instalada : s.origem === 'minha'));
    root.innerHTML = `<div class="skills-inner">
      ${hero()}
      ${list.length ? `<div class="skill-grid">${list.map(card).join('')}</div>`
        : `<div class="empty-state"><p>${filter === 'minhas' ? 'Você ainda não criou nenhuma skill.' : 'Nenhuma skill instalada ainda.'}</p>
           <button class="btn primary" data-act="${filter === 'minhas' ? 'create' : 'see-all'}">${filter === 'minhas' ? 'Criar minha primeira skill' : 'Ver o catálogo'}</button></div>`}
    </div>`;

    bindHero();
    root.querySelector('[data-act="see-all"]')?.addEventListener('click', () => { filter = 'todas'; renderList(); });
    root.querySelectorAll('.skill-card [data-act="toggle"]').forEach((b) => {
      b.onclick = async () => {
        const cardEl = b.closest('.skill-card');
        const s = skills.find((x) => x.id === cardEl.dataset.id);
        b.disabled = true;
        try {
          await toggle(s.id, !s.instalada);
          const fresh = skills.find((x) => x.id === s.id);
          cardEl.classList.toggle('on', fresh.instalada);
          cardEl.classList.add('just-toggled');
          b.className = `btn ${fresh.instalada ? 'installed' : 'primary'} small`;
          b.innerHTML = fresh.instalada ? `${ic.check}Instalada` : `${ic.plus}Instalar`;
          root.querySelectorAll('.tab span').forEach((sp, k) => { sp.textContent = count(TABS[k][0]); });
          if (filter === 'instaladas' && !fresh.instalada) setTimeout(renderList, 250);
        } catch (err) { toast(err.message); }
        b.disabled = false;
      };
    });
  }

  function lojaGrid() {
    const termo = busca.trim().toLowerCase();
    const list = loja.filter((s) => !termo || `${s.nome} ${s.descricao} ${s.comando} ${s.autor}`.toLowerCase().includes(termo));
    if (list.length) return `<div class="skill-grid">${list.map(lojaCard).join('')}</div>`;
    return loja.length
      ? '<div class="empty-state"><p>Nada encontrado com essa busca.</p></div>'
      : '<div class="empty-state"><p>A loja ainda está vazia. Crie uma skill e publique para seus colegas usarem.</p><button class="btn primary" data-act="create">Criar e publicar uma skill</button></div>';
  }

  function renderLoja() {
    root.innerHTML = `<div class="skills-inner">
      ${hero()}
      <label class="search loja-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>
        <input type="search" id="lojaBusca" placeholder="Buscar na loja por nome, comando ou autor" value="${esc(busca)}" autocomplete="off">
      </label>
      <div id="lojaArea">${lojaGrid()}</div>
    </div>`;
    bindHero();
    const area = root.querySelector('#lojaArea');
    const bindCards = () => {
      area.querySelectorAll('[data-act="create"]').forEach((b) => { b.onclick = () => openEditor(); });
      area.querySelectorAll('.loja-card').forEach((cardEl) => {
        const s = loja.find((x) => x.id === cardEl.dataset.loja);
        cardEl.querySelectorAll('[data-act="ver"]').forEach((b) => { b.onclick = () => openLojaItem(s); });
        cardEl.querySelector('[data-act="despublicar"]')?.addEventListener('click', async () => {
          if (!confirm(`Tirar "${s.nome}" da loja? Quem já instalou continua com a própria cópia.`)) return;
          try {
            ({ skills } = await api(`/api/skills/loja/${s.id}`, { method: 'DELETE' }));
            await loadLoja();
            toast('Skill retirada da loja');
            renderList();
          } catch (err) { toast(err.message); }
        });
      });
    };
    bindCards();
    root.querySelector('#lojaBusca').oninput = (e) => {
      busca = e.target.value;
      area.innerHTML = lojaGrid();
      bindCards();
    };
  }

  // Mostra as instruções antes de instalar: elas entram no prompt do Gyde, então a pessoa precisa ler.
  function openLojaItem(s) {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog wide-dialog';
    dlg.innerHTML = `<form method="dialog" class="skill-detail loja-detail">
      <header><span class="skill-symbol big" aria-hidden="true">${esc(s.simbolo)}</span>
        <div><h1>${esc(s.nome)}</h1><p>${esc(s.descricao)}</p>
          <small class="loja-autor">${ic.user}por ${s.minha ? 'você' : esc(s.autor)} · ${s.installs} ${s.installs === 1 ? 'instalação' : 'instalações'}</small></div></header>
      <div class="skill-meta">
        ${s.comando ? `<div><small>Comando</small><code class="cmd">${esc(s.comando)}</code></div>` : ''}
        ${s.gatilhos.length ? `<div class="wide"><small>Ativa sozinha quando a mensagem tiver</small><span class="chips">${s.gatilhos.map((g) => `<span>${esc(g)}</span>`).join('')}</span></div>` : ''}
      </div>
      <section class="skill-body"><h3>Instruções que o Gyde vai seguir</h3><div class="md">${renderMarkdown(s.corpo)}</div></section>
      <p class="loja-aviso">Leia as instruções antes de instalar: elas mudam como o Gyde responde quando a skill está ativa. Você recebe uma cópia sua, que pode editar ou excluir quando quiser.</p>
      <div class="dialog-actions"><button value="cancel" class="btn ghost">Fechar</button>
        ${s.minha || s.instalada ? '' : `<button value="install" class="btn primary">${ic.plus}Instalar cópia</button>`}</div>
    </form>`;
    document.body.append(dlg);
    dlg.querySelector('form').addEventListener('submit', async (e) => {
      if (e.submitter?.value !== 'install') return;
      e.preventDefault();
      try {
        const r = await api(`/api/skills/loja/${s.id}/instalar`, { method: 'POST' });
        skills = r.skills;
        publish();
        dlg.close();
        toast(r.semComando
          ? `Skill instalada sem o comando ${s.comando}, que você já usa. Escolha outro em Editar.`
          : `Skill "${s.nome}" instalada${s.comando ? ` — use ${s.comando}` : ''}`);
        await loadLoja();
        renderList();
      } catch (err) { toast(err.message); }
    });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  function renderDetail(id) {
    const s = skills.find((x) => x.id === id);
    if (!s) { location.hash = '#/skills'; return; }
    const mine = s.origem === 'minha';
    root.innerHTML = `<div class="skills-inner">
      <nav class="crumbs"><a href="#/skills">Skills</a><span>›</span><span>${esc(s.nome)}</span></nav>
      <div class="skill-detail">
        <header>
          <span class="skill-symbol big" aria-hidden="true">${esc(s.simbolo)}</span>
          <div><h1>${esc(s.nome)}</h1><p>${esc(s.descricao)}</p></div>
        </header>
        <div class="skill-meta">
          ${s.comando ? `<div><small>Comando</small><code class="cmd">${esc(s.comando)}</code></div>` : ''}
          <div><small>Categoria</small><b>${origemLabel(s)}</b></div>
          ${s.gatilhos.length ? `<div class="wide"><small>Ativa sozinha quando a mensagem tiver</small><span class="chips">${s.gatilhos.map((g) => `<span>${esc(g)}</span>`).join('')}</span></div>` : ''}
        </div>
        <div class="detail-actions">
          <button class="btn ${s.instalada ? 'installed' : 'primary'}" data-act="toggle">${s.instalada ? `${ic.check}Instalada — remover` : `${ic.plus}Instalar`}</button>
          <a class="btn" href="/api/skills/${encodeURIComponent(s.id)}/export" download>${ic.download}Exportar .md</a>
          ${mine ? `<button class="btn" data-act="edit">${ic.edit}Editar</button>` : ''}
          ${mine && !s.loja ? `<button class="btn" data-act="publicar">${ic.store}${s.publicada ? 'Atualizar na loja' : 'Publicar na loja'}</button>` : ''}
          ${s.publicada ? '<button class="btn" data-act="despublicar">Tirar da loja</button>' : ''}
          ${mine ? `<button class="btn danger" data-act="delete">${ic.trash}Excluir</button>` : ''}
        </div>
        <section class="skill-body"><h3>Instruções que o Gyde segue</h3><div class="md">${renderMarkdown(s.corpo)}</div></section>
      </div>
    </div>`;
    root.querySelector('[data-act="toggle"]').onclick = async () => { await toggle(s.id, !s.instalada).catch((e) => toast(e.message)); renderDetail(id); };
    root.querySelector('[data-act="edit"]')?.addEventListener('click', () => openEditor(s));
    root.querySelector('[data-act="publicar"]')?.addEventListener('click', async () => {
      if (!s.publicada && !confirm(`Publicar "${s.nome}" na loja? Quem usa este Gyde vai ver o nome, a descrição, as instruções e o seu nome.`)) return;
      try {
        const r = await api(`/api/skills/custom/${s.id}/publicar`, { method: 'POST' });
        skills = r.skills;
        toast(r.atualizada ? 'Skill atualizada na loja' : 'Skill publicada na loja');
        renderDetail(id);
      } catch (err) { toast(err.message); }
    });
    root.querySelector('[data-act="despublicar"]')?.addEventListener('click', async () => {
      try {
        ({ skills } = await api(`/api/skills/loja/${s.publicada}`, { method: 'DELETE' }));
        toast('Skill retirada da loja');
        renderDetail(id);
      } catch (err) { toast(err.message); }
    });
    root.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
      if (!confirm(`Excluir a skill "${s.nome}"?${s.publicada ? ' Ela também sai da loja.' : ''} Isso não pode ser desfeito.`)) return;
      ({ skills } = await api(`/api/skills/custom/${s.id}`, { method: 'DELETE' }));
      publish();
      toast('Skill excluída');
      location.hash = '#/skills';
    });
  }

  // Formulário de criar/editar skill.
  function openEditor(existing) {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog wide-dialog';
    const s = existing || { nome: '', descricao: '', simbolo: '◆', comando: '/', gatilhos: [], corpo: '' };
    dlg.innerHTML = `<form method="dialog" class="skill-form">
      <h2>${existing ? 'Editar skill' : 'Criar skill'}</h2>
      <div class="form-row">
        <label class="grow">Nome<input name="nome" maxlength="60" required value="${esc(s.nome)}" placeholder="Ex.: Professor de Java"></label>
        <label>Comando<input name="comando" maxlength="25" value="${esc(s.comando)}" placeholder="/java" pattern="/[a-z0-9-]{2,24}"></label>
      </div>
      <label>Símbolo</label>
      <div class="symbol-picker" role="radiogroup">${SYMBOLS.map((sym) => `<button type="button" role="radio" aria-checked="${sym === s.simbolo}" class="${sym === s.simbolo ? 'selected' : ''}" data-sym="${esc(sym)}">${esc(sym)}</button>`).join('')}</div>
      <label>Descrição curta<input name="descricao" maxlength="240" value="${esc(s.descricao)}" placeholder="O que essa skill faz, em uma frase"></label>
      <label>Palavras que ativam sozinha <small>(separadas por vírgula, opcional)</small><input name="gatilhos" value="${esc(s.gatilhos.join(', '))}" placeholder="java, spring, orientação a objetos"></label>
      <label>Instruções para o Gyde<textarea name="corpo" rows="9" maxlength="8000" required placeholder="Quando esta skill estiver ativa, ...&#10;&#10;Ex.: Explique sempre com exemplos em Java 21, compare com Python quando ajudar e termine com um exercício curto.">${esc(s.corpo)}</textarea></label>
      ${existing?.publicada ? '<p class="loja-aviso">Esta skill está na loja. Depois de salvar, use "Atualizar na loja" para publicar as mudanças.</p>' : ''}
      <p class="gate-error" role="alert" hidden></p>
      <div class="dialog-actions"><button value="cancel" class="btn ghost" formnovalidate>Cancelar</button><button value="save" class="btn primary">Salvar skill</button></div>
    </form>`;
    document.body.append(dlg);
    let symbol = s.simbolo;
    dlg.querySelectorAll('[data-sym]').forEach((b) => {
      b.onclick = () => {
        symbol = b.dataset.sym;
        dlg.querySelectorAll('[data-sym]').forEach((x) => { x.classList.toggle('selected', x === b); x.setAttribute('aria-checked', String(x === b)); });
      };
    });
    const form = dlg.querySelector('form');
    form.addEventListener('submit', async (e) => {
      if (e.submitter?.value !== 'save') return;
      e.preventDefault();
      const body = {
        nome: form.nome.value, descricao: form.descricao.value, simbolo: symbol,
        comando: form.comando.value.trim() === '/' ? '' : form.comando.value.trim().toLowerCase(),
        gatilhos: form.gatilhos.value, corpo: form.corpo.value,
      };
      try {
        const r = await api(existing ? `/api/skills/custom/${existing.id}` : '/api/skills/custom', { method: existing ? 'PUT' : 'POST', body: JSON.stringify(body) });
        skills = r.skills;
        publish();
        dlg.close();
        toast(existing ? 'Skill atualizada' : 'Skill criada e instalada');
        location.hash = `#/skills/${r.id}`;
        if (existing) renderDetail(r.id);
      } catch (err) {
        const el = form.querySelector('.gate-error');
        el.textContent = err.message;
        el.hidden = false;
      }
    });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    form.nome.focus();
  }

  return {
    async show(id) {
      try {
        await Promise.all([load(), loadLoja()]);
        if (id) renderDetail(id); else renderList();
        root.scrollTop = 0;
      } catch (err) {
        root.innerHTML = `<div class="skills-inner"><p class="msg-error">${esc(err.message)}</p></div>`;
      }
    },
    refresh: () => load().catch(() => {}),
  };
}
