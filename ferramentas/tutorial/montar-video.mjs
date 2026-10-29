// Monta o vídeo do tutorial: cenas em HTML (1920x1080) com as capturas reais de docs/tutorial/capturas, a narração de
// docs/tutorial/narracao (voz.wav e tempos.json) e as legendas. Grava quadro a quadro num Edge sem janela e junta com
// o ffmpeg. Saída: docs/tutorial/instalar-o-gyde.mp4 e instalar-o-gyde.vtt.
//   node ferramentas/tutorial/montar-video.mjs [--previa 3,40,90]   (--previa: só fotos desses segundos, para conferir)
// ffmpeg: variável FFMPEG, ou o ffmpeg-static de C:\tools\gyde-video, ou o ffmpeg do PATH.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..', '..');
const TUT = path.join(RAIZ, 'docs', 'tutorial');
const FPS = 24;
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const FFMPEG = process.env.FFMPEG || ['C:/tools/gyde-video/node_modules/ffmpeg-static/ffmpeg.exe'].find(existsSync) || 'ffmpeg';
const tempos = JSON.parse(readFileSync(path.join(TUT, 'narracao', 'tempos.json'), 'utf8'));
const img = (nome) => `data:image/png;base64,${readFileSync(path.join(TUT, 'capturas', `${nome}.png`)).toString('base64')}`;
const logo = readFileSync(path.join(RAIZ, 'pacotes', 'interface', 'public', 'logo.svg'), 'utf8');

// Telas de cada cena. "frase": a partir de qual frase da cena a tela aparece (0 = começo da cena).
// "destaque": retângulo em % da imagem (x, y, largura, altura), mostrado com contorno e zoom lento.
const C = (titulo, linhas, destaque = null, frase = 0) => ({ card: { titulo, linhas, destaque }, frase });
const CENAS = {
  0: [{ abertura: true }],
  1: [{ img: 'passo-09-conversa' }, { img: 'passo-10-pratica', frase: 2 }, { img: 'passo-11-forja-resultado', frase: 3 }],
  2: [C('Onde baixar', ['github.com/gustavomdeschamps/Gyde', 'à direita: <b>Releases</b>', 'abra a versão mais nova'], 1)],
  3: [C('Em Assets, baixe só este', ['<b>Gyde-Setup-2.0.0.exe</b>  ← o instalador', '<s>Gyde-Setup-2.0.0.exe.blockmap</s>  atualizações', '<s>latest.yml</s>  atualizações', '<s>Source code (zip)</s>  código do projeto'], 0)],
  4: [C('O que você precisa', ['Windows 10 ou 11 (64 bits)', 'uns 500 MB livres', 'internet para a IA online', 'não precisa ser administrador'])],
  5: [C('Se o Windows avisar', ['"O Windows protegeu o computador"', 'clique em <b>Mais informações</b>', 'depois em <b>Executar assim mesmo</b>', '<small>(só se você baixou da página oficial)</small>']),
    { img: 'instalador-1-para-quem', frase: 3, destaque: [7, 47, 36, 8], destaque2: [64.5, 89.5, 16, 7.5], borrar: [28.6, 48.3, 13.5, 4.6] }],
  6: [{ img: 'instalador-2-pasta', destaque: [65, 89.5, 15.5, 7.5] }, { img: 'instalador-3-instalando', frase: 1 }, { img: 'instalador-4-concluido', frase: 2, destaque: [35.5, 43, 22, 6], destaque2: [65, 89.5, 15.5, 7.5] }],
  7: [{ img: 'app-1-abrindo' }, { img: 'app-2-primeira-tela', frase: 0, aos: 0.55 }, C('Nos outros dias', ['menu <b>Iniciar</b> → digite <b>Gyde</b>', 'ou o atalho <b>Gyde</b> na Área de Trabalho'], null, 1)],
  8: [{ img: 'passo-08-criar-conta', destaque: null }, { img: 'passo-08-questionario', frase: 1 }, { img: 'passo-08-ia-e-modelos', frase: 2, destaque: [32.5, 24.5, 50, 14] }],
  9: [{ img: 'passo-09-inicio' }, { img: 'passo-09-conversa', frase: 1 }],
  10: [{ img: 'passo-10-pratica' }, { img: 'passo-10-projeto', frase: 1 }],
  11: [{ img: 'passo-11-forja-vazia' }, { img: 'passo-11-forja-resultado', frase: 1 }],
  12: [{ img: 'passo-12-sem-freellmapi', destaque: [30, 7.5, 61.5, 9] }, C('Outros avisos', ['FreeLLMAPI fechado: abra ele e tente de novo', 'respostas lentas: mais chaves no FreeLLMAPI', 'Gyde não abre: <b>Tentar de novo</b> ou <b>Abrir o registro</b>'], null, 1)],
  13: [C('Atualizações e ajuda', ['o Gyde avisa quando sai versão nova', 'atualizar <b>não apaga</b> seus dados', 'guia: <b>COMO-INSTALAR.md</b>', 'ajuda: <b>github.com/gustavomdeschamps/Gyde/issues</b>'])],
  14: [{ encerramento: true }],
};

// monta a linha do tempo: cada tela com início e fim (em segundos)
const porCena = {};
for (const f of tempos) (porCena[f.cena] ??= []).push(f);
const DUR = tempos.at(-1).fim + 1.6;
const linha = [];
const cenasOrdem = Object.keys(porCena).map(Number).sort((a, b) => a - b);
cenasOrdem.forEach((c, k) => {
  const frases = porCena[c];
  const ini = k === 0 ? 0 : frases[0].ini - 0.35;
  const fim = k === cenasOrdem.length - 1 ? DUR : porCena[cenasOrdem[k + 1]][0].ini - 0.35;
  const telas = (CENAS[c] || []).map((t) => ({ ...t, frase: t.frase ?? 0 }));
  telas.forEach((t, i) => {
    const f = frases[Math.min(t.frase, frases.length - 1)];
    let a = t.frase === 0 ? ini : f.ini - 0.25;
    if (t.aos) a = ini + (fim - ini) * t.aos;
    const prox = telas[i + 1];
    let b = fim;
    if (prox) { const fp = frases[Math.min(prox.frase, frases.length - 1)]; b = prox.aos ? ini + (fim - ini) * prox.aos : prox.frase === 0 ? ini : fp.ini - 0.25; }
    linha.push({ cena: c, tela: frases[0].tela, ini: a, fim: b, ...t });
  });
});

const legendas = tempos.map((f) => ({ ini: f.ini, fim: f.fim + 0.25, texto: f.texto }));
const dados = linha.map((t) => ({ ...t, src: t.img ? img(t.img) : null }));

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #0b1220; font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif; color: #e7ebf5; }
  .fundo { position: absolute; inset: 0; background: radial-gradient(1200px 700px at 78% 18%, rgba(59,130,246,.13), transparent 60%), #0b1220; }
  .trilha { position: absolute; inset: 0; opacity: .5; }
  .rotulo { position: absolute; left: 96px; top: 54px; font-size: 30px; font-weight: 600; letter-spacing: .01em; color: #cfe0ff; display: flex; gap: 16px; align-items: center; }
  .rotulo .mini { width: 44px; height: 44px; } .rotulo .mini svg { width: 100%; height: 100%; }
  .tela { position: absolute; left: 0; right: 0; top: 124px; bottom: 196px; display: grid; place-items: center; }
  .moldura { position: relative; border-radius: 16px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(148,163,184,.18); background: #111827; }
  .moldura .zoom { position: relative; transform-origin: 50% 50%; }
  .moldura img { display: block; }
  .destaque { position: absolute; border: 4px solid #3b82f6; border-radius: 10px; box-shadow: 0 0 0 9999px rgba(11,18,32,.35), 0 0 24px rgba(59,130,246,.6); }
  .destaque.semveu { box-shadow: 0 0 24px rgba(59,130,246,.6); }
  .borrar { position: absolute; backdrop-filter: blur(7px); background: rgba(240,240,240,.55); border-radius: 4px; }
  .card { width: 1180px; padding: 64px 80px; border-radius: 24px; background: #111a2e; box-shadow: 0 30px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(148,163,184,.16); }
  .card h2 { margin: 0 0 30px; font-size: 52px; font-weight: 650; color: #fff; }
  .card li { list-style: none; font-size: 38px; line-height: 1.35; padding: 12px 0 12px 44px; position: relative; color: #cbd5e1; }
  .card li::before { content: ""; position: absolute; left: 6px; top: 32px; width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; }
  .card li.marcada { color: #fff; background: rgba(59,130,246,.14); border-radius: 12px; outline: 3px solid #3b82f6; padding-left: 44px; margin-left: -12px; padding-right: 12px; }
  .card b { color: #fff; } .card s { color: #64748b; } .card small { font-size: 28px; color: #94a3b8; }
  .card ul { margin: 0; padding: 0; }
  .legenda { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%); max-width: 1500px; padding: 14px 28px; border-radius: 12px; background: rgba(2,6,23,.82); font-size: 36px; line-height: 1.3; text-align: center; color: #fff; }
  .abertura { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
  .abertura .logo { width: 170px; height: 170px; margin: 0 auto 34px; } .abertura .logo svg { width: 100%; height: 100%; }
  .abertura h1 { margin: 0; font-size: 84px; font-weight: 650; color: #fff; letter-spacing: -.01em; }
  .abertura p { margin: 18px 0 0; font-size: 36px; color: #93a3bd; }
  .camada { position: absolute; inset: 0; }
</style></head><body>
<div class="fundo"></div>
<svg class="trilha" viewBox="0 0 1920 1080"><path d="M-40 1000C300 820 700 980 900 700S1500 380 1960 120" fill="none" stroke="#3b82f6" stroke-opacity=".10" stroke-width="40" stroke-linecap="round"/></svg>
<div id="palco"></div>
<div class="legenda" id="legenda"></div>
<script>
const DADOS = ${JSON.stringify(dados)};
const LEG = ${JSON.stringify(legendas)};
const LOGO = ${JSON.stringify(logo)};
const palco = document.getElementById('palco'), leg = document.getElementById('legenda');
const LARG = 1700, ALT = 760; // área útil das capturas
const camadas = DADOS.map((t) => {
  const d = document.createElement('div'); d.className = 'camada'; d.style.opacity = 0;
  if (t.abertura || t.encerramento) {
    d.innerHTML = '<div class="abertura"><div><div class="logo">' + LOGO + '</div><h1>' + (t.abertura ? 'Como instalar o Gyde' : 'Bons estudos!') + '</h1><p>' + (t.abertura ? 'no Windows, passo a passo' : 'github.com/gustavomdeschamps/Gyde') + '</p></div></div>';
  } else {
    d.innerHTML = '<div class="rotulo"><span class="mini">' + LOGO + '</span>' + t.tela + '</div><div class="tela"></div>';
    const area = d.querySelector('.tela');
    if (t.card) {
      area.innerHTML = '<div class="card"><h2>' + t.card.titulo + '</h2><ul>' + t.card.linhas.map((l, i) => '<li class="' + (i === t.card.destaque ? 'marcada' : '') + '">' + l + '</li>').join('') + '</ul></div>';
    } else {
      const m = document.createElement('div'); m.className = 'moldura';
      m.innerHTML = '<div class="zoom"><img src="' + t.src + '"></div>';
      area.appendChild(m);
      const im = m.querySelector('img');
      im.onload = () => {
        const k = Math.min(LARG / im.naturalWidth, ALT / im.naturalHeight, im.naturalWidth < 800 ? 2.1 : 1.2);
        im.style.width = im.naturalWidth * k + 'px';
        const z = m.querySelector('.zoom');
        for (const [chave, cls] of [['destaque', 'destaque'], ['destaque2', 'destaque semveu'], ['borrar', 'borrar']]) {
          if (!t[chave]) continue;
          const [x, y, w, h] = t[chave]; const b = document.createElement('div'); b.className = cls;
          Object.assign(b.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' }); z.appendChild(b);
        }
        d.dataset.pronta = '1';
      };
    }
  }
  palco.appendChild(d); return d;
});
window.render = (s) => {
  DADOS.forEach((t, i) => {
    const entra = Math.min(1, Math.max(0, (s - t.ini) / 0.35)), sai = Math.min(1, Math.max(0, (t.fim - s) / 0.35));
    const o = Math.min(entra, sai); camadas[i].style.opacity = o; camadas[i].style.visibility = o > 0 ? 'visible' : 'hidden';
    const z = camadas[i].querySelector('.zoom');
    if (z && o > 0) {
      const p = Math.min(1, Math.max(0, (s - t.ini) / Math.max(1, t.fim - t.ini)));
      const alvo = t.destaque || null;
      const esc = 1 + 0.07 * p;
      if (alvo) z.style.transformOrigin = (alvo[0] + alvo[2] / 2) + '% ' + (alvo[1] + alvo[3] / 2) + '%';
      z.style.transform = 'scale(' + esc + ')';
      z.querySelectorAll('.destaque').forEach((b) => { b.style.opacity = Math.min(1, Math.max(0, (s - t.ini - 0.6) / 0.4)); });
    }
  });
  const l = LEG.find((x) => s >= x.ini && s <= x.fim);
  leg.textContent = l ? l.texto : ''; leg.style.visibility = l ? 'visible' : 'hidden';
};
window.pronto = () => [...document.querySelectorAll('.camada')].every((c, i) => !DADOS[i].src || c.dataset.pronta);
</script></body></html>`;

const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-video-'));
const pagina = path.join(pasta, 'video.html');
writeFileSync(pagina, html);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const porta = await new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${path.join(pasta, 'perfil')}`, '--allow-file-access-from-files', '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let alvos; for (let i = 0; i < 40 && !alvos; i++) { try { alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); } catch { await espera(250); } }
const ws = new WebSocket(alvos.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const enviar = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await enviar('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await enviar('Page.navigate', { url: `file:///${pagina.replaceAll('\\', '/')}` });
for (let i = 0; i < 80; i++) { const r = await enviar('Runtime.evaluate', { expression: 'window.pronto && window.pronto()', returnByValue: true }); if (r.result?.result?.value) break; await espera(250); }
await espera(800);
const foto = async (s, formato = 'jpeg') => { await enviar('Runtime.evaluate', { expression: `render(${s})` }); return Buffer.from((await enviar('Page.captureScreenshot', { format: formato, quality: 92 })).result.data, 'base64'); };

const previa = arg('previa');
if (previa) {
  for (const s of previa.split(',')) writeFileSync(path.join(pasta, `previa-${s}.jpg`), await foto(Number(s)));
  console.log('prévias em', pasta);
} else {
  const quadros = path.join(pasta, 'quadros'); mkdirSync(quadros);
  const total = Math.ceil(DUR * FPS);
  for (let f = 0; f < total; f++) { writeFileSync(path.join(quadros, `q${String(f).padStart(5, '0')}.jpg`), await foto(f / FPS)); if (f % 480 === 0) console.log('quadro', f, '/', total); }
  const saida = path.join(TUT, 'instalar-o-gyde.mp4');
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', path.join(quadros, 'q%05d.jpg'), '-i', path.join(TUT, 'narracao', 'voz.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', saida], { stdio: 'inherit' });
  const vtt = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`; };
  writeFileSync(path.join(TUT, 'instalar-o-gyde.vtt'), `WEBVTT\n\n${legendas.map((l, i) => `${i + 1}\n${vtt(l.ini)} --> ${vtt(l.fim)}\n${l.texto}\n`).join('\n')}`);
  console.log('vídeo:', path.relative(RAIZ, saida), `${DUR.toFixed(1)} s`);
}
ws.close(); edge.kill();
await new Promise((r) => (edge.exitCode !== null ? r() : edge.once('exit', r)));
if (!previa) { await espera(500); try { rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* perfil preso */ } }
