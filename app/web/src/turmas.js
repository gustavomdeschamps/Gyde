// Página de Turmas: criar/entrar, tarefas e o painel do professor.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  enter: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .5 3.2 2 3.5 5"/></svg>',
};
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '');

export function createTurmasPage({ root, api, toast, getTracks }) {
  async function renderHome() {
    root.innerHTML = '<div class="skills-inner"><div class="skeleton" style="height:140px;margin-top:24px"></div></div>';
    const data = await api('/api/turmas');
    root.innerHTML = `<div class="skills-inner">
      <header class="skills-hero"><div><h1>Turmas</h1>
        <p>Professor: crie uma turma, passe exercícios da Prática e acompanhe cada aluno. Aluno: entre com o código que o professor passar.</p></div></header>
      <div class="turma-forms">
        <form class="turma-form" data-form="criar"><h2>${ic.plus}Criar turma</h2>
          <div class="row"><input name="name" maxlength="60" placeholder="Ex.: 2º ano Informática — manhã" required><button class="btn primary">Criar</button></div></form>
        <form class="turma-form" data-form="entrar"><h2>${ic.enter}Entrar numa turma</h2>
          <div class="row"><input name="code" maxlength="8" placeholder="Código (ex.: K7PX2M)" required autocomplete="off" style="text-transform:uppercase;letter-spacing:.12em"><button class="btn">Entrar</button></div></form>
      </div>
      ${data.ensino.length ? `<h2 class="section-title">Turmas que eu ensino</h2><div class="track-grid">${data.ensino.map((t, i) => `
        <a class="track-card" href="#/turmas/${t.id}" style="--i:${i}">
          <div class="track-top"><span class="track-icon">${ic.users}</span><span class="lang-badge">Professor</span></div>
          <h2>${esc(t.name)}</h2><p>Código <b class="turma-code-inline">${esc(t.code)}</b></p>
          <div class="track-meta"><span>${t.alunos} ${t.alunos === 1 ? 'aluno' : 'alunos'} · ${t.tarefas} tarefas</span><span>Abrir →</span></div></a>`).join('')}</div>` : ''}
      ${data.participo.length ? `<h2 class="section-title">Turmas em que estou</h2><div class="track-grid">${data.participo.map((t, i) => {
        const pct = t.tarefas ? Math.round((t.feitas / t.tarefas) * 100) : 0;
        return `<a class="track-card" href="#/turmas/${t.id}" style="--i:${i}">
          <div class="track-top"><span class="track-icon">${ic.users}</span><span class="lang-badge">Aluno</span></div>
          <h2>${esc(t.name)}</h2><p>Professor: ${esc(t.professor)}</p>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="track-meta"><span>${t.feitas}/${t.tarefas} tarefas feitas</span><span>Abrir →</span></div></a>`;
      }).join('')}</div>` : ''}
      ${!data.ensino.length && !data.participo.length ? '<div class="empty-state" style="margin-top:22px"><p>Você ainda não está em nenhuma turma.</p></div>' : ''}
    </div>`;
    root.querySelector('[data-form="criar"]').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api('/api/turmas', { method: 'POST', body: JSON.stringify({ name: e.target.name.value }) }); location.hash = `#/turmas/${r.id}`; } catch (err) { toast(err.message); }
    };
    root.querySelector('[data-form="entrar"]').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api('/api/turmas/entrar', { method: 'POST', body: JSON.stringify({ code: e.target.code.value }) }); toast('Você entrou na turma'); location.hash = `#/turmas/${r.id}`; } catch (err) { toast(err.message); }
    };
  }

  async function renderTurma(id) {
    let t;
    try { t = await api(`/api/turmas/${id}`); } catch (err) { toast(err.message); location.hash = '#/turmas'; return; }
    const head = `<nav class="crumbs"><a href="#/turmas">Turmas</a><span>›</span><span>${esc(t.name)}</span></nav>`;

    if (!t.professor) {
      const feitas = t.tarefas.filter((k) => k.feita).length;
      root.innerHTML = `<div class="skills-inner">${head}
        <header class="skills-hero"><div><h1>${esc(t.name)}</h1><p>Professor: ${esc(t.professorNome)} · ${feitas} de ${t.tarefas.length} tarefas feitas</p></div>
          <button class="btn danger" data-act="sair">Sair da turma</button></header>
        <div class="ex-list">${t.tarefas.length ? t.tarefas.map((k, i) => `
          <a class="ex-item${k.feita ? ' done' : ''}" href="#/pratica/${k.trackId}/${k.exerciseId}" style="--i:${i}">
            <span class="ex-num">${k.feita ? ic.check : i + 1}</span>
            <span class="ex-title"><b>${esc(k.title)}</b><small>${esc(k.track)}${k.prazo ? ` · prazo ${fmtDate(k.prazo)}` : ''}</small></span>
            ${k.feita ? '<span class="xp-pill">feita</span>' : k.prazo && k.prazo < new Date().toLocaleDateString('sv-SE') ? '<span class="badge late">atrasada</span>' : ''}
          </a>`).join('') : '<div class="empty-state"><p>O professor ainda não passou tarefas.</p></div>'}</div></div>`;
      root.querySelector('[data-act="sair"]').onclick = async () => {
        if (!confirm('Sair desta turma?')) return;
        await api(`/api/turmas/${t.id}`, { method: 'DELETE' });
        location.hash = '#/turmas';
      };
      return;
    }

    // Visão do professor
    const tracks = (await getTracks()) || [];
    const options = tracks.map((tr) => `<optgroup label="${esc(tr.title)}">${tr.exercises.map((ex) => `<option value="${esc(ex.id)}">${esc(ex.title)}</option>`).join('')}</optgroup>`).join('');
    root.innerHTML = `<div class="skills-inner">${head}
      <header class="skills-hero"><div><h1>${esc(t.name)}</h1><p>${t.alunos.length} ${t.alunos.length === 1 ? 'aluno' : 'alunos'} · ${t.tarefas.length} tarefas</p></div>
        <div class="turma-code"><small>Código da turma</small><b>${esc(t.code)}</b><button class="btn small" data-act="copiar">${ic.copy}Copiar</button></div></header>

      <form class="turma-form wide" data-form="tarefa"><h2>${ic.plus}Passar tarefa</h2>
        <div class="row"><select name="exerciseId" required><option value="">Escolha um exercício da Prática…</option>${options}</select>
        <input type="date" name="prazo" title="Prazo (opcional)"><button class="btn primary">Adicionar</button></div></form>

      <h2 class="section-title">Painel da turma <small>quem fez cada tarefa</small></h2>
      ${t.alunos.length && t.tarefas.length ? `<div class="turma-table-wrap"><table class="turma-table">
        <thead><tr><th>Aluno</th>${t.tarefas.map((k, j) => `<th title="${esc(k.title)}"><span>${j + 1}. ${esc(k.title)}</span>${k.prazo ? `<small>até ${fmtDate(k.prazo)}</small>` : ''}<button class="x" data-del-task="${k.id}" title="Remover tarefa">×</button></th>`).join('')}<th>Feitas</th><th>XP</th></tr></thead>
        <tbody>${t.alunos.map((a, i) => {
          const n = a.feitas.filter(Boolean).length;
          return `<tr style="--i:${i}"><td><b>${esc(a.name)}</b><small>${a.ultimoDia ? `ativo em ${fmtDate(a.ultimoDia)}` : 'ainda não praticou'}</small></td>
            ${a.feitas.map((f) => `<td class="cell ${f ? 'ok' : ''}">${f ? ic.check : '–'}</td>`).join('')}
            <td><b>${n}/${t.tarefas.length}</b></td><td>${a.xp}</td></tr>`;
        }).join('')}</tbody></table></div>`
        : `<div class="empty-state"><p>${!t.alunos.length ? `Nenhum aluno ainda. Passe o código <b>${esc(t.code)}</b> para a turma entrar em Turmas → Entrar numa turma.` : 'Passe a primeira tarefa para começar a acompanhar.'}</p></div>`}
      ${t.alunos.length ? `<details class="turma-alunos"><summary>Alunos (${t.alunos.length})</summary><ul>${t.alunos.map((a) => `<li>${esc(a.name)} <small>${esc(a.email)}</small><button class="btn small danger" data-del-aluno="${a.id}">Remover</button></li>`).join('')}</ul></details>` : ''}
      <button class="btn danger" data-act="apagar" style="margin-top:22px">${ic.trash}Apagar turma</button>
    </div>`;

    root.querySelector('[data-act="copiar"]').onclick = async (e) => {
      try { await navigator.clipboard.writeText(t.code); e.currentTarget.innerHTML = `${ic.check}Copiado`; } catch { toast('Não consegui copiar'); }
    };
    root.querySelector('[data-form="tarefa"]').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/turmas/${t.id}/tarefas`, { method: 'POST', body: JSON.stringify({ exerciseId: e.target.exerciseId.value, prazo: e.target.prazo.value }) });
        toast('Tarefa passada para a turma');
        renderTurma(t.id);
      } catch (err) { toast(err.message); }
    };
    root.querySelectorAll('[data-del-task]').forEach((b) => {
      b.onclick = async () => { if (!confirm('Remover esta tarefa da turma?')) return; await api(`/api/turmas/${t.id}/tarefas/${b.dataset.delTask}`, { method: 'DELETE' }); renderTurma(t.id); };
    });
    root.querySelectorAll('[data-del-aluno]').forEach((b) => {
      b.onclick = async () => { if (!confirm('Remover este aluno da turma?')) return; await api(`/api/turmas/${t.id}/alunos/${b.dataset.delAluno}`, { method: 'DELETE' }); renderTurma(t.id); };
    });
    root.querySelector('[data-act="apagar"]').onclick = async () => {
      if (!confirm(`Apagar a turma "${t.name}"? Os alunos saem dela e as tarefas somem.`)) return;
      await api(`/api/turmas/${t.id}`, { method: 'DELETE' });
      location.hash = '#/turmas';
    };
  }

  return {
    async show(id) {
      try {
        if (id) await renderTurma(id); else await renderHome();
        root.scrollTop = 0;
      } catch (err) {
        root.innerHTML = `<div class="skills-inner"><p class="msg-error">${esc(err.message)}</p></div>`;
      }
    },
  };
}
