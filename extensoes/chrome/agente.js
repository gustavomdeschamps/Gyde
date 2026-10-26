// Modo agente do painel: você dá um comando e o Gyde usa a aba sozinho. Uma seta animada vai
// até cada botão ou campo, clica e digita letra por letra. Ele só para quando a ação não tem
// volta (comprar, enviar, excluir), quando falta informação, ou em campos de senha, cartão e
// documentos, que nunca preenche. Quem preferir pode ligar "pedir permissão a cada passo".

// ---------- Funções injetadas na página (precisam ser autossuficientes) ----------
function snapshotPage() {
  const SENSIVEL = /senha|password|passwd|cvv|cvc|cart[aã]o|card.?num|cc-|cpf|rg\b|one-time|otp|token|pin\b/i;
  document.querySelectorAll('[data-gyde-n]').forEach((el) => el.removeAttribute('data-gyde-n'));
  const seletor = 'a[href], button, input:not([type=hidden]), textarea, select, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [contenteditable="true"]';
  const elementos = [];
  let n = 0;
  for (const el of document.querySelectorAll(seletor)) {
    if (el.closest('#gyde-cursor')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < -100 || r.top > innerHeight * 2.5) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
    n += 1;
    el.setAttribute('data-gyde-n', String(n));
    const tag = el.tagName.toLowerCase();
    const tipo = el.getAttribute('role') || (tag === 'input' ? `campo ${el.type}` : { a: 'link', button: 'botão', textarea: 'caixa de texto', select: 'lista', summary: 'expandir' }[tag] || tag);
    const label = el.labels?.[0] ? [...el.labels[0].childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ') : '';
    const rotulo = (el.getAttribute('aria-label') || label || (tag === 'select' ? '' : el.innerText) || el.placeholder || el.title || el.name || el.alt || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const sensivel = el.type === 'password' || SENSIVEL.test(`${el.name} ${el.id} ${el.autocomplete} ${el.placeholder} ${rotulo}`);
    let desc = `${tipo} "${rotulo}"`;
    if (tag === 'a') desc += ` → ${el.getAttribute('href').slice(0, 60)}`;
    if (sensivel) desc += ' (CAMPO SENSÍVEL: só a pessoa preenche)';
    else if ((tag === 'input' || tag === 'textarea') && el.value && !['checkbox', 'radio'].includes(el.type)) desc += ` valor atual: "${el.value.slice(0, 40)}"`;
    if (tag === 'select') desc += ` opções: ${[...el.options].slice(0, 12).map((o) => o.text.trim()).join(' | ')}`;
    if (['checkbox', 'radio'].includes(el.type)) desc += el.checked ? ' (marcado)' : ' (desmarcado)';
    if (el.disabled) desc += ' (desativado)';
    elementos.push({ n, desc });
    if (n >= 150) break;
  }
  const texto = (document.querySelector('main, article, [role="main"]') || document.body).innerText.replace(/\n{3,}/g, '\n\n');
  return { titulo: document.title, url: location.href, elementos, texto: texto.slice(0, 6000) };
}

// Seta do Gyde: aparece na página, desliza até o elemento e mostra um balão com o que vai fazer.
async function moveCursor(n, rotulo) {
  let cur = document.getElementById('gyde-cursor');
  if (!cur) {
    cur = document.createElement('div');
    cur.id = 'gyde-cursor';
    cur.style.cssText = `position:fixed;z-index:2147483647;left:0;top:0;pointer-events:none;transform:translate(${innerWidth / 2}px,${innerHeight / 2}px);transition:transform .65s cubic-bezier(.22,1,.36,1)`;
    cur.innerHTML = `<svg width="26" height="30" viewBox="0 0 26 30" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))"><path d="M2 2l20 11.5-9 2.2-4.6 8.8z" fill="#2563eb" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
      <span style="position:absolute;left:22px;top:22px;background:#2563eb;color:#fff;font:600 12px system-ui,sans-serif;padding:4px 9px;border-radius:8px;white-space:nowrap;box-shadow:0 4px 14px rgba(37,99,235,.4)"></span>`;
    document.documentElement.append(cur);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  cur.querySelector('span').textContent = rotulo;
  const el = n == null ? null : document.querySelector(`[data-gyde-n="${n}"]`);
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise((r) => setTimeout(r, 350));
    const b = el.getBoundingClientRect();
    cur.style.transform = `translate(${b.left + Math.min(b.width / 2, 40)}px,${b.top + b.height / 2}px)`;
  }
  await new Promise((r) => setTimeout(r, 700));
  return Boolean(el) || n == null;
}

function hideCursor() {
  document.getElementById('gyde-cursor')?.remove();
}

async function performAction(acao) {
  const SENSIVEL = /senha|password|passwd|cvv|cvc|cart[aã]o|card.?num|cc-|cpf|rg\b|one-time|otp|token|pin\b/i;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ripple = () => {
    const cur = document.getElementById('gyde-cursor');
    if (!cur) return;
    const ring = document.createElement('i');
    ring.style.cssText = 'position:absolute;left:-14px;top:-14px;width:30px;height:30px;border-radius:50%;border:3px solid #2563eb;opacity:.9;transition:transform .45s ease-out,opacity .45s ease-out';
    cur.append(ring);
    requestAnimationFrame(() => { ring.style.transform = 'scale(2.2)'; ring.style.opacity = '0'; });
    setTimeout(() => ring.remove(), 500);
  };
  if (acao.tipo === 'rolar') { scrollBy({ top: (acao.direcao === 'cima' ? -1 : 1) * innerHeight * 0.8, behavior: 'smooth' }); return { ok: true }; }
  if (acao.tipo === 'voltar') { history.back(); return { ok: true }; }
  const el = document.querySelector(`[data-gyde-n="${acao.alvo}"]`);
  if (!el) return { ok: false, erro: `O elemento [${acao.alvo}] não está mais na página.` };
  if (acao.tipo === 'clicar') { ripple(); await sleep(120); el.focus?.(); el.click(); return { ok: true }; }
  if (acao.tipo === 'digitar') {
    const rotulo = `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder} ${el.getAttribute('aria-label') || ''} ${el.labels?.[0]?.innerText || ''}`;
    if (el.type === 'password' || SENSIVEL.test(rotulo)) return { ok: false, erro: 'Campo sensível (senha, cartão ou documento): preencha você mesmo.' };
    ripple();
    el.focus();
    const setter = el.isContentEditable ? null
      : Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
    const set = (v) => { if (setter) setter.call(el, v); else el.textContent = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('');
    const delay = Math.min(45, 1800 / Math.max(1, acao.texto.length)); // digita letra por letra, no máximo ~2 s
    for (let i = 1; i <= acao.texto.length; i++) { set(acao.texto.slice(0, i)); await sleep(delay); }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (acao.enviar) {
      await sleep(200);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      if (el.form) el.form.requestSubmit();
    }
    return { ok: true };
  }
  if (acao.tipo === 'selecionar') {
    if (el.tagName !== 'SELECT') return { ok: false, erro: 'Esse elemento não é uma lista de opções.' };
    const alvo = acao.texto.trim().toLowerCase();
    const opt = [...el.options].find((o) => o.text.trim().toLowerCase() === alvo) || [...el.options].find((o) => o.text.toLowerCase().includes(alvo));
    if (!opt) return { ok: false, erro: `Não achei a opção "${acao.texto}".` };
    ripple();
    el.value = opt.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }
  return { ok: false, erro: 'Ação desconhecida.' };
}

// ---------- Painel ----------
const PROTEGIDA = /^(chrome|edge|about|chrome-extension|devtools|view-source):|^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createAgent({ api, addMessage, esc, md, ensurePageAccess, activeTab, onBusy, askEveryStep }) {
  let run = null; // tarefa em andamento

  const descreve = (acao, alvoDesc) => ({
    clicar: `Clicar em ${alvoDesc}`,
    digitar: `Digitar "${acao.texto}" em ${alvoDesc}${acao.enviar ? ' e apertar Enter' : ''}`,
    selecionar: `Escolher "${acao.texto}" em ${alvoDesc}`,
    rolar: `Rolar a página para ${acao.direcao}`,
    abrir: `Abrir ${acao.url}`,
    voltar: 'Voltar para a página anterior',
  }[acao.tipo]);
  const balao = { clicar: 'Clicando', digitar: 'Digitando', selecionar: 'Escolhendo' };

  async function inTab(tabId, func, args = []) {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
    return result;
  }

  async function waitLoad(tabId) {
    await sleep(600);
    for (let i = 0; i < 30; i++) {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab || tab.status === 'complete') break;
      await sleep(300);
    }
    await sleep(250);
  }

  // Cartão de confirmação: resolve com 'sim', 'pular' ou 'parar'.
  function confirmCard(explicacao, texto, aviso) {
    const card = addMessage('assistant', `<div class="agent-card${aviso ? ' warn' : ''}">
      <small>${aviso ? 'Confirme antes: esta ação não tem volta' : 'Próximo passo'}</small>
      <b>${esc(texto)}</b>
      ${explicacao ? `<p>${esc(explicacao)}</p>` : ''}
      <div class="agent-actions">
        <button class="btn primary" data-r="sim">Fazer</button>
        <button class="btn" data-r="pular">Não fazer</button>
        <button class="btn danger" data-r="parar">Parar</button>
      </div></div>`);
    return new Promise((resolve) => {
      run.cancelConfirm = () => resolve('parar');
      card.querySelectorAll('[data-r]').forEach((b) => {
        b.onclick = () => {
          card.querySelector('.agent-actions').innerHTML = `<span class="agent-done">${{ sim: '✓ Feito', pular: '→ Não feito', parar: '■ Parado' }[b.dataset.r]}</span>`;
          resolve(b.dataset.r);
        };
      });
      card.querySelector('[data-r="sim"]').focus();
    });
  }

  function log(text, kind = '') {
    return addMessage('assistant', `<div class="agent-log ${kind}">${esc(text)}</div>`);
  }

  async function loop() {
    const r = run;
    while (r.active) {
      const tab = await activeTab();
      if (!tab || PROTEGIDA.test(tab.url || '')) {
        log('Esta aba é uma página protegida do navegador. Abra um site comum e peça de novo.', 'erro');
        break;
      }
      let pagina;
      try {
        pagina = await inTab(tab.id, snapshotPage);
      } catch {
        log('Não consegui ler esta aba.', 'erro');
        break;
      }
      const thinking = addMessage('assistant', '<div class="md"><div class="thinking"><i></i><i></i><i></i></div></div>');
      let passo;
      try {
        passo = await (await api('/api/agente/passo', { method: 'POST', body: JSON.stringify({ objetivo: r.objetivo, pagina, historico: r.historico }) })).json();
      } catch (e) {
        thinking.remove();
        log(e.message, 'erro');
        break;
      }
      thinking.remove();
      if (!r.active) break;
      const { acao, explicacao, confirmar } = passo;

      if (acao.tipo === 'concluir') {
        await inTab(tab.id, hideCursor).catch(() => {});
        addMessage('assistant', `<div class="md">${md(acao.texto || 'Pronto.')}</div>`);
        break;
      }
      if (acao.tipo === 'perguntar') {
        addMessage('assistant', `<div class="md">${md(acao.texto)}</div><small class="agent-hint">Responda na caixa abaixo para eu continuar, ou clique em Parar.</small>`);
        r.esperando = true;
        return; // continua quando a pessoa responder (answer())
      }

      const alvo = pagina.elementos.find((e) => e.n === acao.alvo);
      const usaAlvo = ['clicar', 'digitar', 'selecionar'].includes(acao.tipo);
      if (usaAlvo && !alvo) { r.historico.push(`Tentou usar [${acao.alvo}], que não existe na página.`); continue; }
      if (acao.tipo === 'digitar' && /CAMPO SENSÍVEL/.test(alvo.desc)) {
        log('Aqui é um campo sensível (senha, cartão ou documento): essa parte é com você. Preencha e me diga "continua".', 'erro');
        r.historico.push(`Parou: o campo [${acao.alvo}] é sensível. A pessoa vai preencher.`);
        r.esperando = true;
        return;
      }
      const texto = descreve(acao, alvo ? alvo.desc.replace(/ \(.*$/, '') : '');
      if (usaAlvo) await inTab(tab.id, moveCursor, [acao.alvo, `${balao[acao.tipo]}…`]).catch(() => {});
      if (!r.active) break;

      // Pergunta só se a pessoa pediu, ou se a ação não tem volta.
      if (confirmar || (askEveryStep() && acao.tipo !== 'rolar')) {
        const resposta = await confirmCard(explicacao, texto, confirmar);
        if (!r.active || resposta === 'parar') break;
        if (resposta === 'pular') {
          r.historico.push(`A pessoa NÃO quis: ${texto}. Escolha outro caminho ou pergunte.`);
          continue;
        }
      } else {
        log(`→ ${texto}`);
      }
      try {
        if (acao.tipo === 'abrir') {
          await chrome.tabs.update(tab.id, { url: acao.url });
        } else {
          const out = await inTab(tab.id, performAction, [acao]);
          if (!out.ok) throw new Error(out.erro);
        }
        r.historico.push(`Feito: ${texto}`);
      } catch (e) {
        log(e.message, 'erro');
        r.historico.push(`Falhou: ${texto} (${e.message})`);
      }
      await waitLoad(tab.id);
    }
    finish();
  }

  async function finish() {
    if (!run) return;
    run.active = false;
    run = null;
    onBusy(false);
    const tab = await activeTab().catch(() => null);
    if (tab && !PROTEGIDA.test(tab.url || '')) inTab(tab.id, hideCursor).catch(() => {});
  }

  return {
    get waiting() { return Boolean(run?.esperando); },
    get running() { return Boolean(run); },
    async start(objetivo) {
      if (!(await ensurePageAccess())) { log('Preciso de permissão para ver e usar as páginas.', 'erro'); return; }
      run = { objetivo, historico: [], active: true, esperando: false, cancelConfirm: null };
      onBusy(true);
      addMessage('user', `<div class="bubble"><span class="agent-tag">Agente</span> ${esc(objetivo)}</div>`);
      loop().catch((e) => { log(e.message, 'erro'); finish(); });
    },
    answer(texto) {
      if (!run?.esperando) return;
      addMessage('user', `<div class="bubble">${esc(texto)}</div>`);
      run.historico.push(`A pessoa respondeu: ${texto}`);
      run.esperando = false;
      loop().catch((e) => { log(e.message, 'erro'); finish(); });
    },
    stop() {
      if (!run) return;
      run.cancelConfirm?.();
      log('Agente parado.');
      finish();
    },
  };
}
