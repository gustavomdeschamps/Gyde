// Vídeo de abertura. Aparece só na primeira vez que o Gyde é aberto neste navegador (fica marcado no localStorage,
// sem nada externo). Dá para rever em Configurações > Geral. Vem antes do login, então a marca é do navegador.
// Se o navegador segurar o som automático, o vídeo toca sem som e o som liga no primeiro clique ou tecla.
// No fim, a logo do vídeo vira a logo de verdade e voa até o lugar dela, enquanto a tela real aparece por trás
// num círculo que se abre a partir da logo. preparar() monta a tela real alguns segundos antes.

interface InfoAbertura { logo?: { x: number; y: number; lado: number }; legendas?: { ini: number; fim: number; texto: string }[] }
const infoAbertura: Promise<InfoAbertura> = fetch('/intro.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;

function visivel(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight ? r : null;
}
const CHAVE = 'gyde-intro-vista';
export const aberturaJaVista = () => { try { return localStorage.getItem(CHAVE) === '1' || sessionStorage.getItem('gyde-intro-visto') === '1'; } catch { return false; } };
// marca logo que começa: atualizar no meio, pular ou falhar a reprodução não faz o vídeo voltar
const marcarVista = () => { try { localStorage.setItem(CHAVE, '1'); } catch { /* sem storage: some ao fechar a aba */ } };

export function tocarAbertura({ preparar = () => {} }: { preparar?: () => void } = {}): Promise<void> {
  marcarVista();
  return new Promise((pronto) => {
    const caixa = $('#intro'), video = $<HTMLVideoElement>('#introVideo'), dica = $('#introSom'), botaoSom = $('#introSomBtn'), legenda = $('#introLegenda');
    caixa.hidden = false; caixa.classList.remove('revelando'); caixa.style.removeProperty('--r');
    dica.hidden = true; legenda.classList.remove('on');
    let terminou = false, preparado = false, info: InfoAbertura = {};
    infoAbertura.then((i) => { info = i; });
    const prepara = () => { if (!preparado) { preparado = true; preparar(); } };
    const mostrarSom = () => { botaoSom.setAttribute('aria-pressed', String(!video.muted)); botaoSom.title = video.muted ? 'Ligar o som' : 'Desligar o som'; };
    const ligarSom = () => { if (!video.muted) return; video.muted = false; dica.hidden = true; mostrarSom(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fim(false); else ligarSom(); };
    botaoSom.onclick = (e) => { e.stopPropagation(); video.muted = !video.muted; dica.hidden = true; mostrarSom(); };
    const limpar = () => {
      caixa.hidden = true; caixa.classList.remove('revelando', 'closing'); caixa.style.removeProperty('--r');
      video.currentTime = 0; legenda.classList.remove('on'); pronto();
    };
    const fim = (natural: boolean) => {
      if (terminou) return;
      terminou = true;
      document.removeEventListener('keydown', tecla);
      caixa.removeEventListener('pointerdown', ligarSom);
      video.pause(); legenda.classList.remove('on'); dica.hidden = true;
      prepara();
      const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!natural || reduzir || !info.logo) { caixa.classList.add('closing'); setTimeout(limpar, 380); return; }
      // espera a tela real existir (o login ou o app) antes de revelar
      requestAnimationFrame(() => requestAnimationFrame(() => passagem(info.logo!)));
    };
    // onde a logo está no último quadro (object-fit: cover na tela larga, contain na tela alta)
    const retanguloDaLogo = (logo: NonNullable<InfoAbertura['logo']>) => {
      const caber = matchMedia('(max-aspect-ratio: 13/10)').matches;
      const esc = (caber ? Math.min : Math.max)(innerWidth / 1920, innerHeight / 1080), vw = 1920 * esc, vh = 1080 * esc;
      const ox = (innerWidth - vw) / 2, oy = (innerHeight - vh) / 2, lado = logo.lado * vh;
      return { x: ox + logo.x * vw - lado / 2, y: oy + logo.y * vh - lado / 2, lado };
    };
    const passagem = (infoLogo: NonNullable<InfoAbertura['logo']>) => {
      const de = retanguloDaLogo(infoLogo);
      const alvoEl = [document.querySelector('#gate:not([hidden]) .gate-brand img'), $('.empty-logo'), $('.brand-mark')].find((el) => visivel(el)) as HTMLElement | undefined;
      const logo = document.createElement('img');
      logo.src = '/logo.svg'; logo.alt = ''; logo.className = 'intro-logo';
      Object.assign(logo.style, { left: `${de.x}px`, top: `${de.y}px`, width: `${de.lado}px`, height: `${de.lado}px` });
      document.body.append(logo);
      caixa.style.setProperty('--mx', `${de.x + de.lado / 2}px`); caixa.style.setProperty('--my', `${de.y + de.lado / 2}px`);
      const raioFinal = Math.hypot(innerWidth, innerHeight);
      logo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' }).finished.then(() => {
        caixa.classList.add('revelando');
        caixa.animate([{ '--r': '0px' }, { '--r': `${raioFinal}px` }] as unknown as Keyframe[], { duration: 1100, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
        const alvo = visivel(alvoEl ?? null);
        if (alvoEl && alvo) {
          alvoEl.style.visibility = 'hidden';
          const k = alvo.width / de.lado, dx = alvo.left - de.x, dy = alvo.top - de.y;
          logo.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: 1050, delay: 120, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' })
            .finished.then(() => { alvoEl.style.visibility = ''; logo.remove(); limpar(); });
        } else {
          logo.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 700, delay: 300, easing: 'ease-out', fill: 'forwards' })
            .finished.then(() => { logo.remove(); limpar(); });
        }
      });
    };
    if (!video.getAttribute('src')) { video.src = video.dataset.src ?? ''; video.preload = 'auto'; } // só baixa quando vai tocar
    video.currentTime = 0;
    video.muted = false;
    video.play().then(mostrarSom).catch(() => {
      video.muted = true;
      dica.hidden = false; mostrarSom();
      video.play().catch(() => fim(false)); // sem nem tocar mudo: segue para o login
    });
    // legendas por cima do vídeo (sempre visíveis, mesmo com o vídeo ampliado)
    video.ontimeupdate = () => {
      const c = (info.legendas || []).find((x) => video.currentTime >= x.ini && video.currentTime <= x.fim);
      if (c && legenda.textContent !== c.texto) legenda.textContent = c.texto;
      legenda.classList.toggle('on', Boolean(c));
      if (video.duration && video.currentTime > video.duration - 3.5) prepara();
    };
    video.onended = () => fim(true);
    video.onerror = () => fim(false);
    caixa.addEventListener('pointerdown', ligarSom);
    document.addEventListener('keydown', tecla);
  });
}
