// Markdown das respostas: código colorido com botões (Executar, Passo a passo, Copiar) e HTML sempre sanitizado.
import { icone as svgIcone } from './icones.ts';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from '@highlightjs/cdn-assets/es/highlight.min.js';
import { execute, RUNNABLE, type Linguagem } from './runner.ts';
import { openTrace } from './passo-a-passo.ts';
import { copiarTexto, escaparHtml } from './util.ts';

const icone = {
  play: svgIcone('play'),
  passos: svgIcone('list-checks'),
  copiar: svgIcone('copy'),
};

marked.setOptions({ gfm: true, breaks: false });
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  const linguagem = (lang || '').trim().split(/\s+/)[0]!.toLowerCase();
  const conhecida = linguagem && hljs.getLanguage(linguagem);
  const html = conhecida ? hljs.highlight(text, { language: linguagem, ignoreIllegals: true }).value : escaparHtml(text);
  const roda = RUNNABLE[linguagem];
  const acoes = [
    roda ? `<button type="button" class="run-code" data-lang="${roda}" title="Executar este código no navegador">${icone.play}Executar</button>` : '',
    roda === 'python' ? `<button type="button" class="trace-code" title="Ver a execução linha por linha">${icone.passos}Passo a passo</button>` : '',
    `<button type="button" class="copy-code" data-label="1">${icone.copiar}Copiar</button>`,
  ].join('');
  return `<div class="code-block"><div class="code-head"><span>${escaparHtml(linguagem || 'código')}</span>
    <div class="code-actions">${acoes}</div></div>
    <pre><code class="hljs">${html}</code></pre></div>`;
};
renderer.link = ({ href, title, text }) =>
  `<a href="${escaparHtml(href || '')}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escaparHtml(title)}"` : ''}>${text}</a>`;
marked.use({ renderer });

export function renderMarkdown(texto: string): string {
  return DOMPurify.sanitize(marked.parse(texto, { async: false }), { ADD_ATTR: ['target'] });
}

// Executa o código de um bloco da resposta e mostra a saída logo abaixo dele.
async function executarBloco(botao: HTMLButtonElement) {
  const bloco = botao.closest('.code-block')!;
  const codigo = (bloco.querySelector('pre code') as HTMLElement).innerText;
  let saida = bloco.querySelector<HTMLElement>('.run-output');
  if (!saida) { saida = document.createElement('div'); saida.className = 'run-output'; bloco.append(saida); }
  const alvo = saida;
  alvo.innerHTML = '<span class="run-label">Saída</span><div class="loading-line"><div class="thinking"><i></i><i></i><i></i></div>Executando…</div>';
  botao.disabled = true;
  const r = await execute(botao.dataset.lang as Linguagem, { mode: 'run', code: codigo, fn: '__nenhuma__', tests: [] }, () => {
    const linha = alvo.querySelector('.loading-line');
    if (linha?.lastChild) linha.lastChild.textContent = 'Preparando o Python no navegador… (só demora na primeira vez)';
  });
  const linhas = (r.logs ?? []).map((l) => escaparHtml(l));
  if (r.error) linhas.push(`<span class="err">${escaparHtml(String(r.error))}</span>`);
  if (!linhas.length) linhas.push('<span class="ok">Rodou sem erros</span> (o código não imprimiu nada).');
  alvo.innerHTML = `<span class="run-label">Saída</span>${linhas.join('\n')}`;
  botao.disabled = false;
}

// Cliques dentro de uma resposta: botões dos blocos de código e imagens geradas. Devolve true se tratou.
export function tratarCliqueNaResposta(e: MouseEvent): boolean {
  const alvo = e.target as Element;
  const copiar = alvo.closest<HTMLElement>('.copy-code');
  if (copiar) { copiarTexto((copiar.closest('.code-block')!.querySelector('code') as HTMLElement).innerText, copiar); return true; }
  const rodar = alvo.closest<HTMLButtonElement>('.run-code');
  if (rodar) { executarBloco(rodar); return true; }
  const passo = alvo.closest('.trace-code');
  if (passo) { openTrace((passo.closest('.code-block')!.querySelector('pre code') as HTMLElement).innerText); return true; }
  const img = alvo.closest<HTMLImageElement>('.md img');
  if (img) { window.open(img.src, '_blank', 'noopener'); return true; }
  return false;
}
