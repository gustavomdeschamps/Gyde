// GIF animado sem dependências, para o tutorial da documentação (ferramentas/gravar-tutorial.mjs):
//  - lê PNG (cor RGB ou RGBA de 8 bits, sem entrelaçamento, como o navegador fotografa) com o zlib do Node;
//  - paleta única de até 256 cores, escolhida pelas cores mais frequentes de todos os quadros (telas de interface têm
//    poucas cores; não há pontilhado);
//  - cada quadro grava só o retângulo que mudou em relação ao anterior (o GIF fica bem menor);
//  - compressão LZW do formato GIF89a.
import { inflateSync } from 'node:zlib';

/** PNG -> { largura, altura, rgb (3 bytes por pixel) }. */
export function lerPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('não é PNG');
  let pos = 8, largura = 0, altura = 0, tipo = 0, profundidade = 0, entrelacado = 0;
  const dados = [];
  while (pos < buf.length) {
    const tam = buf.readUInt32BE(pos), nome = buf.toString('ascii', pos + 4, pos + 8), corpo = buf.subarray(pos + 8, pos + 8 + tam);
    if (nome === 'IHDR') { largura = corpo.readUInt32BE(0); altura = corpo.readUInt32BE(4); profundidade = corpo[8]; tipo = corpo[9]; entrelacado = corpo[12]; }
    else if (nome === 'IDAT') dados.push(corpo);
    else if (nome === 'IEND') break;
    pos += 12 + tam;
  }
  if (profundidade !== 8 || ![2, 6].includes(tipo) || entrelacado) throw new Error('PNG não suportado (só RGB/RGBA de 8 bits, sem entrelaçamento)');
  const bpp = tipo === 6 ? 4 : 3, linha = largura * bpp;
  const cru = inflateSync(Buffer.concat(dados));
  const px = Buffer.alloc(altura * linha);
  for (let y = 0; y < altura; y++) {
    const f = cru[y * (linha + 1)], ini = y * (linha + 1) + 1;
    for (let x = 0; x < linha; x++) {
      const a = x >= bpp ? px[y * linha + x - bpp] : 0, b = y ? px[(y - 1) * linha + x] : 0, c = x >= bpp && y ? px[(y - 1) * linha + x - bpp] : 0;
      let v = cru[ini + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * linha + x] = v & 255;
    }
  }
  const rgb = Buffer.alloc(largura * altura * 3);
  for (let i = 0, j = 0; i < largura * altura; i++, j += bpp) { rgb[i * 3] = px[j]; rgb[i * 3 + 1] = px[j + 1]; rgb[i * 3 + 2] = px[j + 2]; }
  return { largura, altura, rgb };
}

const chave15 = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/** Paleta das 256 cores (5 bits por canal) mais frequentes nos quadros. */
export function paletaDe(quadros) {
  const conta = new Uint32Array(32768);
  for (const q of quadros) for (let i = 0; i < q.rgb.length; i += 3 * 2) conta[chave15(q.rgb[i], q.rgb[i + 1], q.rgb[i + 2])]++; // um pixel sim, outro não: basta
  const ordem = [...conta.keys()].filter((k) => conta[k]).sort((a, b) => conta[b] - conta[a]).slice(0, 256);
  return ordem.map((k) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4]);
}

function indexador(paleta) {
  const cache = new Int16Array(32768).fill(-1);
  return (r, g, b) => {
    const k = chave15(r, g, b);
    if (cache[k] >= 0) return cache[k];
    let melhor = 0, dist = Infinity;
    for (let i = 0; i < paleta.length; i++) {
      const [pr, pg, pb] = paleta[i], d = (pr - r) ** 2 * 2 + (pg - g) ** 2 * 4 + (pb - b) ** 2 * 3;
      if (d < dist) { dist = d; melhor = i; }
    }
    return (cache[k] = melhor);
  };
}

function lzw(indices, minimo) {
  const saida = [];
  let acumulado = 0, bits = 0;
  const escrever = (codigo, tam) => { acumulado |= codigo << bits; bits += tam; while (bits >= 8) { saida.push(acumulado & 255); acumulado >>>= 8; bits -= 8; } };
  const limpar = 1 << minimo, fim = limpar + 1;
  let tam = minimo + 1, proximo = fim + 1;
  let dic = new Map();
  escrever(limpar, tam);
  let atual = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], chave = atual * 4096 + k;
    const achado = dic.get(chave);
    if (achado !== undefined) { atual = achado; continue; }
    escrever(atual, tam);
    if (proximo < 4096) { dic.set(chave, proximo++); if (proximo > (1 << tam) && tam < 12) tam++; }
    else { escrever(limpar, tam); dic = new Map(); tam = minimo + 1; proximo = fim + 1; }
    atual = k;
  }
  escrever(atual, tam);
  escrever(fim, tam);
  if (bits > 0) saida.push(acumulado & 255);
  return Buffer.from(saida);
}
const emBlocos = (dados) => { const p = []; for (let i = 0; i < dados.length; i += 255) { const b = dados.subarray(i, i + 255); p.push(Buffer.from([b.length]), b); } p.push(Buffer.from([0])); return Buffer.concat(p); };

/** quadros: [{ largura, altura, rgb, atraso (centésimos de segundo) }] do mesmo tamanho -> Buffer do GIF. */
export function montarGif(quadros) {
  const { largura, altura } = quadros[0];
  const paleta = paletaDe(quadros);
  while (paleta.length < 256) paleta.push([0, 0, 0]);
  const indice = indexador(paleta);
  const partes = [Buffer.from('GIF89a', 'ascii')];
  const lsd = Buffer.alloc(7); lsd.writeUInt16LE(largura, 0); lsd.writeUInt16LE(altura, 2); lsd[4] = 0xf7; partes.push(lsd);
  partes.push(Buffer.from(paleta.flat()));
  partes.push(Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01, 0x00, 0x00, 0x00])); // repete sempre
  let anterior = null;
  for (const q of quadros) {
    const idx = new Uint8Array(largura * altura);
    for (let i = 0; i < idx.length; i++) idx[i] = indice(q.rgb[i * 3], q.rgb[i * 3 + 1], q.rgb[i * 3 + 2]);
    // só o retângulo que mudou
    let x0 = 0, y0 = 0, x1 = largura - 1, y1 = altura - 1;
    if (anterior) {
      x0 = largura; y0 = altura; x1 = -1; y1 = -1;
      for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) if (idx[y * largura + x] !== anterior[y * largura + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; } // igual ao anterior: um pixel só, para guardar o tempo
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const sub = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) sub.set(idx.subarray((y0 + y) * largura + x0, (y0 + y) * largura + x0 + w), y * w);
    const gce = Buffer.from([0x21, 0xf9, 0x04, 0x04, 0, 0, 0, 0]); gce.writeUInt16LE(q.atraso ?? 100, 4); // 0x04: não apagar (o resto do quadro fica)
    const img = Buffer.alloc(10); img[0] = 0x2c; img.writeUInt16LE(x0, 1); img.writeUInt16LE(y0, 3); img.writeUInt16LE(w, 5); img.writeUInt16LE(h, 7); img[9] = 0;
    partes.push(gce, img, Buffer.from([8]), emBlocos(lzw(sub, 8)));
    anterior = idx;
  }
  partes.push(Buffer.from([0x3b]));
  return Buffer.concat(partes);
}
