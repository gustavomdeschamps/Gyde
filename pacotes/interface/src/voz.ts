import { desktop } from './desktop.ts';

// Voz: ler respostas em voz alta (voz do próprio Windows/navegador) e ditado (fala vira texto).

export function textoParaFala(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' (tem um bloco de código aqui na tela) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[#>|-]+\s*/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const temVoz = typeof window !== 'undefined' && 'speechSynthesis' in window;
if (temVoz) speechSynthesis.getVoices(); // carrega a lista de vozes

let botaoFalando: HTMLElement | null = null;
// segundo clique no mesmo botão para de falar
export function falar(markdown: string, botao: HTMLElement) {
  const synth = window.speechSynthesis;
  const eraEste = botaoFalando === botao;
  synth.cancel();
  botaoFalando?.classList.remove('speaking');
  botaoFalando = null;
  if (eraEste) return;
  const u = new SpeechSynthesisUtterance(textoParaFala(markdown));
  u.lang = 'pt-BR';
  const vozes = synth.getVoices();
  const voz = vozes.find((v) => v.lang === 'pt-BR' && /natural|online/i.test(v.name)) || vozes.find((v) => v.lang === 'pt-BR');
  if (voz) u.voice = voz;
  u.rate = 1.05;
  u.onend = u.onerror = () => { botao.classList.remove('speaking'); if (botaoFalando === botao) botaoFalando = null; };
  botao.classList.add('speaking');
  botaoFalando = botao;
  synth.speak(u);
}

// Ditado. Dizer "enviar" no final manda a mensagem.
interface ResultadoFala { isFinal: boolean; 0: { transcript: string } }
interface Reconhecimento {
  lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ResultadoFala> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
}
const janela = window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento };
const Reconhecedor = janela.SpeechRecognition || janela.webkitSpeechRecognition;
// no app de desktop (Electron) o reconhecimento de fala do Chrome não funciona: falha com "network"
export const temDitado = Boolean(Reconhecedor) && !desktop;
const PALAVRAS_ENVIAR = /\s*\b(enviar|envia|mandar|manda)[.!]?\s*$/i;

export function ditar({ inicial, aoMudar, aoEnviar, aoErro, aoTerminar }: {
  inicial: string; aoMudar: (texto: string) => void; aoEnviar: (texto: string) => void; aoErro: (msg: string) => void; aoTerminar: () => void;
}) {
  if (!Reconhecedor) return null;
  const rec = new Reconhecedor();
  rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = true;
  const base = inicial ? inicial.replace(/\s*$/, ' ') : '';
  let final = '';
  rec.onresult = (e) => {
    let parcial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]!; if (r.isFinal) final += r[0].transcript; else parcial += r[0].transcript; }
    aoMudar(base + final + parcial);
    if (PALAVRAS_ENVIAR.test(final)) { rec.stop(); aoEnviar((base + final).replace(PALAVRAS_ENVIAR, '').trim()); }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed') aoErro('Permita o uso do microfone para falar com o Gyde');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') aoErro('O ditado parou: ' + e.error);
  };
  rec.onend = aoTerminar;
  rec.start();
  return { parar: () => rec.stop() };
}
