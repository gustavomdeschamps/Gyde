// Narração do tutorial: lê as frases de docs/tutorial/roteiro.md (seção "Narração e texto na tela"), gera cada uma com
// o Gemini TTS (chave GEMINI_API_KEY do .env, nunca mostrada), corta o silêncio das pontas e junta com pausas iguais.
// Cada frase fica em cache (pelo texto, voz e estilo): rodar de novo só gera o que faltou ou mudou.
// Saída: docs/tutorial/narracao/voz.wav e tempos.json (início e fim de cada frase, com a cena).
//   node ferramentas/tutorial/narrar.mjs [--voz Charon]
//   node ferramentas/tutorial/narrar.mjs --motor windows [--voz "Microsoft Maria Desktop"]   (voz do próprio Windows, sem
//   internet e sem cota: o Gemini TTS grátis permite só 10 pedidos por dia por modelo)
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..', '..');
const PASTA = path.join(RAIZ, 'docs', 'tutorial', 'narracao');
const CACHE = path.join(PASTA, 'frases');
mkdirSync(CACHE, { recursive: true });
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const MOTOR = arg('motor', 'gemini');
const VOZ = arg('voz', MOTOR === 'windows' ? 'Microsoft Maria Desktop' : 'Charon');
const ESTILO = 'Leia em português do Brasil, com voz calma, clara e amigável, como um professor explicando passo a passo para quem nunca instalou um programa. Leia só o texto abaixo, sem acrescentar nada:';
const PAUSA = 0.45, PAUSA_CENA = 0.9;
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (MOTOR === 'gemini' && !env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY não está no .env.'); process.exit(1); }
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- frases do roteiro, com a cena de cada uma ----------
function frasesDoRoteiro(texto) {
  const secao = texto.split('## Narração e texto na tela')[1]?.split('## Produção')[0] ?? '';
  const frases = []; let cena = null;
  for (const linha of secao.split(/\r?\n/)) {
    const c = linha.match(/^\*\*(\d+)\. (.+?)\*\* · tela: "(.+)"/);
    if (c) { cena = { n: Number(c[1]), nome: c[2], tela: c[3] }; continue; }
    const f = linha.match(/^- (.+)/);
    if (f && cena) frases.push({ cena: cena.n, tela: cena.tela, texto: f[1].trim() });
  }
  return frases;
}

// voz do Windows (System.Speech): grava um WAV de 24 kHz, 16 bits, mono e devolve só o PCM
function gerarWindows(texto) {
  const wav = path.join(tmpdir(), `gyde-voz-${process.pid}.wav`), txt = path.join(tmpdir(), `gyde-voz-${process.pid}.txt`);
  writeFileSync(txt, texto, 'utf8');
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoice('${VOZ}'); $s.Rate = 0; `
    + `$f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo 24000, ([System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen), ([System.Speech.AudioFormat.AudioChannel]::Mono); `
    + `$s.SetOutputToWaveFile('${wav}', $f); $s.Speak([IO.File]::ReadAllText('${txt}', [Text.Encoding]::UTF8)); $s.Dispose()`;
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`voz do Windows falhou: ${r.stderr}`);
  const b = readFileSync(wav); unlinkSync(wav); unlinkSync(txt);
  return b.subarray(b.indexOf('data') + 8);
}

async function gerar(texto) {
  if (MOTOR === 'windows') return gerarWindows(texto);
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    for (const modelo of ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(120_000),
        headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${ESTILO}\n\n${texto}` }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } } } }),
      }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
      if (r.ok) {
        const j = await r.json();
        const b64 = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
        if (b64) return Buffer.from(b64, 'base64'); // PCM 16 bits, mono, 24 kHz
      } else console.log(`  ${modelo}: ${r.status} ${(await r.text()).slice(0, 120).replace(/\s+/g, ' ')}`);
    }
    await espera(r429(tentativa)); // limite por minuto do TTS: espera e tenta de novo
  }
  throw new Error(`não consegui gerar: ${texto}`);
}
const r429 = (n) => Math.min(65_000, 15_000 * (n + 1));

const aparar = (pcm, taxa) => { // corta o silêncio do começo e do fim
  const limiar = 500; let a = 0, z = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a]) < limiar) a++;
  while (z > a && Math.abs(pcm[z]) < limiar) z--;
  return pcm.slice(Math.max(0, a - Math.round(taxa * 0.03)), Math.min(pcm.length, z + Math.round(taxa * 0.1)));
};

{
  const frases = frasesDoRoteiro(readFileSync(path.join(RAIZ, 'docs', 'tutorial', 'roteiro.md'), 'utf8'));
  console.log(`${frases.length} frases, voz ${VOZ}`);
  const TAXA = 24000;
  const pedacos = [], tempos = []; let t = 0.4, cenaAnterior = null;
  for (const [i, f] of frases.entries()) {
    const chave = createHash('sha1').update(`${MOTOR === 'windows' ? 'win|' : ''}${VOZ}|${ESTILO}|${f.texto}`).digest('hex').slice(0, 16);
    const arq = path.join(CACHE, `${chave}.pcm`);
    let pcm;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      if (!existsSync(arq)) { writeFileSync(arq, await gerar(f.texto)); console.log(`gerada ${i + 1}/${frases.length}`); }
      const b = readFileSync(arq);
      pcm = aparar(new Int16Array(b.buffer, b.byteOffset, Math.floor(b.length / 2)), TAXA);
      // o TTS às vezes devolve áudio comprido demais (repete ou inventa): gera de novo
      if (pcm.length / TAXA < f.texto.length * 0.085 + 2.5) break;
      console.log(`  frase ${i + 1} longa demais (${(pcm.length / TAXA).toFixed(1)} s): gerando de novo`);
      unlinkSync(arq);
    }
    if (cenaAnterior !== null && f.cena !== cenaAnterior) t += PAUSA_CENA - PAUSA;
    tempos.push({ cena: f.cena, tela: f.tela, texto: f.texto, ini: +t.toFixed(2), fim: +(t + pcm.length / TAXA).toFixed(2) });
    pedacos.push({ inicio: t, pcm });
    t += pcm.length / TAXA + PAUSA; cenaAnterior = f.cena;
  }
  const total = Math.round((t + 1.2) * TAXA), dados = new Int16Array(total);
  for (const p of pedacos) dados.set(p.pcm, Math.round(p.inicio * TAXA));
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + dados.length * 2, 4); cab.write('WAVE', 8); cab.write('fmt ', 12); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(TAXA, 24); cab.writeUInt32LE(TAXA * 2, 28); cab.writeUInt16LE(2, 32); cab.writeUInt16LE(16, 34); cab.write('data', 36); cab.writeUInt32LE(dados.length * 2, 40);
  writeFileSync(path.join(PASTA, 'voz.wav'), Buffer.concat([cab, Buffer.from(dados.buffer)]));
  writeFileSync(path.join(PASTA, 'tempos.json'), JSON.stringify(tempos, null, 1));
  console.log(`narração: ${(total / TAXA).toFixed(1)} s`);
}
