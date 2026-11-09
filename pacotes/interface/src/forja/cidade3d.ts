// Cidade do código em 3D (Three.js). Este arquivo só é baixado quando a aba Cidade abre (import dinâmico em Cidade.svelte).
// Direção de arte: cidade noturna em neon. Pasta = bairro (quadra com borda acesa), arquivo = prédio com janelas,
// altura = tamanho, calor = quantas vezes mudou no git (os mais alterados viram faróis vermelho/laranja).
// Ruas ligam cada bairro à pasta-mãe, com "tráfego de dados" correndo por elas.
// Qualidades: Leve e Média desenham direto na tela (funcionam em placa integrada); a Média faz o "brilho" com halos
// aditivos, sem pós-processamento. A Alta (bloom de verdade, com imagem fora da tela) só liga quando a pessoa escolhe.
// Desempenho: tudo repetido é InstancedMesh (poucas chamadas de desenho); a qualidade baixa sozinha pelo FPS;
// com "menos movimento" não há entrada animada, órbita, pulsos nem voo de câmera, e a cena só desenha quando algo muda.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { TPredio } from '$contratos';
import { calorDe, bairroDe } from './cidade-comum.ts';
import * as S from './cidade3d-shaders.ts';

export type Qualidade = 'alta' | 'media' | 'leve';
export interface Cidade3D {
  destruir(): void;
  selecionar(caminho: string | null): void; // destaca um prédio (ou nenhum)
  focar(caminho: string): void; // leva a câmera até o prédio
  filtrar(termo: string): number; // escurece o que não combina; devolve quantos combinam
  definirQualidade(q: Qualidade | 'auto'): void;
  diagnostico(): string; // texto para copiar (placa, qualidade, formatos, checagens, erros; nada pessoal)
}
interface Opcoes {
  aoEscolher: (p: TPredio | null) => void; // clique (ou toque) num prédio, ou no vazio
  aoPassar: (p: TPredio | null, x: number, y: number) => void; // mouse em cima de um prédio
  aoQualidade?: (q: Qualidade, automatica: boolean) => void;
  aoAviso?: (texto: string, grave: boolean) => void; // aviso discreto (ex.: a qualidade baixou porque os prédios não apareceram)
  qualidade?: Qualidade | 'auto';
}

const CELULA = 1.6; // espaço de cada prédio na quadra
const LADO = 1; // largura do prédio
const MARGEM = 0.9; // borda da quadra em volta dos prédios
const RUA = 1.6; // espaço entre quadras
const CHAO = 0.06; // altura da laje das quadras
// raiz quadrada com teto: um arquivo de 7 mil linhas não esconde o resto da cidade
export const alturaDe = (p: TPredio) => 0.3 + Math.min(12, Math.sqrt(p.binario ? p.bytes / 40 : p.linhas) * 0.22);

// Quadras (bairros) em fileiras, da esquerda para a direita, formando uma cidade mais ou menos quadrada.
export function montarPlanta(arquivos: TPredio[]) {
  const grupos = new Map<string, TPredio[]>();
  for (const a of arquivos) { const b = bairroDe(a.caminho); (grupos.get(b) ?? grupos.set(b, []).get(b)!).push(a); }
  const quadras = [...grupos].sort(([a], [b]) => a.localeCompare(b)).map(([nome, lista]) => {
    const colunas = Math.ceil(Math.sqrt(lista.length));
    const linhas = Math.ceil(lista.length / colunas);
    return { nome, lista, colunas, largura: colunas * CELULA + MARGEM * 2 - (CELULA - LADO), fundo: linhas * CELULA + MARGEM * 2 - (CELULA - LADO), x: 0, z: 0 };
  });
  const area = quadras.reduce((n, q) => n + (q.largura + RUA) * (q.fundo + RUA), 0);
  const alvo = Math.max(Math.sqrt(area) * 1.15, ...quadras.map((q) => q.largura));
  let x = 0, z = 0, fundoDaFileira = 0, larguraTotal = 0;
  for (const q of quadras) {
    if (x > 0 && x + q.largura > alvo) { x = 0; z += fundoDaFileira + RUA; fundoDaFileira = 0; }
    q.x = x; q.z = z;
    x += q.largura + RUA; fundoDaFileira = Math.max(fundoDaFileira, q.fundo); larguraTotal = Math.max(larguraTotal, x - RUA);
  }
  const fundoTotal = z + fundoDaFileira;
  const predios: { p: TPredio; x: number; z: number; h: number; quadra: number }[] = [];
  quadras.forEach((q, iq) => {
    q.x -= larguraTotal / 2; q.z -= fundoTotal / 2; // cidade centrada na origem
    q.lista.forEach((p, i) => predios.push({ p, h: alturaDe(p), quadra: iq,
      x: q.x + MARGEM + (i % q.colunas) * CELULA + LADO / 2, z: q.z + MARGEM + Math.floor(i / q.colunas) * CELULA + LADO / 2 }));
  });
  return { quadras, predios, largura: larguraTotal, fundo: fundoTotal };
}

// Ruas: cada bairro liga à pasta-mãe mais próxima que também é bairro (ou à praça central), em "L" pelo chão.
export function montarRuas(quadras: { nome: string; x: number; z: number; largura: number; fundo: number }[]) {
  const centro = (q: (typeof quadras)[number]) => [q.x + q.largura / 2, q.z + q.fundo / 2] as const;
  const porNome = new Map(quadras.map((q) => [q.nome, q]));
  const ruas: [number, number, number, number][] = [];
  for (const q of quadras) {
    if (q.nome === '') continue;
    let mae = q.nome;
    let alvo: (typeof quadras)[number] | undefined;
    while (mae.includes('/')) { mae = mae.slice(0, mae.lastIndexOf('/')); if ((alvo = porNome.get(mae))) break; }
    alvo ??= porNome.get('');
    const [ax, az] = centro(q);
    const [bx, bz] = alvo ? centro(alvo) : [0, 0];
    if (Math.abs(bx - ax) > 0.01) ruas.push([ax, az, bx, az]);
    if (Math.abs(bz - az) > 0.01) ruas.push([bx, az, bx, bz]);
  }
  return ruas;
}

// paleta (valores multiplicados acima de 1 brilham com o bloom)
const COR = {
  ceuHorizonte: '#2a1b5c', ceuMeio: '#120d33', ceuTopo: '#04040f', nevoa: '#160f3a',
  corpo: '#0e1336', corpoAlto: '#2a2068', borda: '#7c5cff', lua: '#9db4ff',
  quente: '#ff2a3d', laranja: '#ff8a1f', janelaFria: '#7fe3ff', janelaQuente: '#ffd27a',
  rua: '#2fd9ff', quadra: '#8b6cff', trafego: '#9ff3ff', chao: '#05061a', chaoBrilho: '#3b1f8f', grade: '#3a3f9e',
  realce: '#5ee7ff', escolhido: '#ffffff',
};
const hdr = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

export function criarCidade3D(caixa: HTMLElement, arquivos: TPredio[], opcoes: Opcoes): Cidade3D {
  const { aoEscolher, aoPassar, aoQualidade, aoAviso } = opcoes;
  const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const celular = matchMedia('(pointer: coarse)').matches || caixa.clientWidth < 640;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); // sem WebGL, lança erro e a tela oferece a lista
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'cidade-canvas';
  caixa.append(renderer.domElement);

  const cena = new THREE.Scene();
  const planta = montarPlanta(arquivos);
  const tamanho = Math.max(planta.largura, planta.fundo, 12);
  const raio = Math.hypot(planta.largura, planta.fundo) / 2 + 4;
  cena.fog = new THREE.FogExp2(new THREE.Color(COR.nevoa), 0.46 / (tamanho * 1.6));
  const descartar: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(x: T) => { descartar.push(x); return x; };
  const comNevoa = (u: Record<string, THREE.IUniform>) => ({ ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...u });
  const tempo = { value: 0 };

  // ---------- céu e estrelas ----------
  const ceu = new THREE.Mesh(guardar(new THREE.SphereGeometry(tamanho * 8, 32, 16)), guardar(new THREE.ShaderMaterial({
    vertexShader: S.ceuVertex, fragmentShader: S.ceuFragment, side: THREE.BackSide, depthWrite: false,
    uniforms: { uHorizonte: { value: new THREE.Color(COR.ceuHorizonte) }, uMeio: { value: new THREE.Color(COR.ceuMeio) }, uTopo: { value: new THREE.Color(COR.ceuTopo) } },
  })));
  ceu.renderOrder = -10;
  cena.add(ceu);
  const pixel = { value: 1 };
  const nEstrelas = 420;
  const posEstrelas = new Float32Array(nEstrelas * 3), brilhoEstrelas = new Float32Array(nEstrelas);
  for (let i = 0; i < nEstrelas; i++) {
    const t = Math.random() * Math.PI * 2, f = Math.acos(1 - Math.random() * 0.85), r = tamanho * 7;
    posEstrelas.set([r * Math.sin(f) * Math.cos(t), r * Math.cos(f), r * Math.sin(f) * Math.sin(t)], i * 3);
    brilhoEstrelas[i] = Math.random() ** 3;
  }
  const geoEstrelas = guardar(new THREE.BufferGeometry());
  geoEstrelas.setAttribute('position', new THREE.BufferAttribute(posEstrelas, 3));
  geoEstrelas.setAttribute('aBrilho', new THREE.BufferAttribute(brilhoEstrelas, 1));
  const estrelas = new THREE.Points(geoEstrelas, guardar(new THREE.ShaderMaterial({
    vertexShader: S.estrelasVertex, fragmentShader: S.estrelasFragment, uniforms: { uTempo: tempo, uPixel: pixel },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));
  estrelas.renderOrder = -9;
  cena.add(estrelas);

  // ---------- chão de vidro escuro ----------
  const chao = new THREE.Mesh(guardar(new THREE.PlaneGeometry(tamanho * 7, tamanho * 7).rotateX(-Math.PI / 2)), guardar(new THREE.ShaderMaterial({
    vertexShader: S.chaoVertex, fragmentShader: S.chaoFragment, fog: true, transparent: true,
    uniforms: comNevoa({ uRaio: { value: raio }, uFundo: { value: new THREE.Color(COR.chao) }, uBrilho: { value: new THREE.Color(COR.chaoBrilho) }, uGrade: { value: new THREE.Color(COR.grade) } }),
  })));
  chao.renderOrder = -1;
  cena.add(chao);

  // ---------- quadras: laje escura ----------
  const m = new THREE.Matrix4();
  const lajes = new THREE.InstancedMesh(guardar(new THREE.BoxGeometry(1, CHAO, 1).translate(0, CHAO / 2, 0)),
    guardar(new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c1030') })), Math.max(1, planta.quadras.length));
  planta.quadras.forEach((q, i) => { m.makeScale(q.largura, 1, q.fundo).setPosition(q.x + q.largura / 2, 0, q.z + q.fundo / 2); lajes.setMatrixAt(i, m); });
  lajes.count = planta.quadras.length;
  cena.add(lajes);

  // ---------- faixas de neon: bordas das quadras e ruas (uma malha só) ----------
  const vertsFaixa: number[] = [], uvsFaixa: number[] = [], distFaixa: number[] = [], tipoFaixa: number[] = [], idxFaixa: number[] = [];
  const faixa = (ax: number, az: number, bx: number, bz: number, largura: number, y: number, tipo: number, dist0 = 0) => {
    const dx = bx - ax, dz = bz - az, comp = Math.hypot(dx, dz);
    if (comp < 0.01) return;
    const nx = (-dz / comp) * largura / 2, nz = (dx / comp) * largura / 2;
    const base = vertsFaixa.length / 3;
    vertsFaixa.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
    uvsFaixa.push(0, 0, 0, 1, 1, 0, 1, 1);
    distFaixa.push(dist0, dist0, dist0 + comp, dist0 + comp);
    tipoFaixa.push(tipo, tipo, tipo, tipo);
    idxFaixa.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  };
  for (const q of planta.quadras) {
    const y = CHAO + 0.004, e = 0.09, x0 = q.x + e / 2, x1 = q.x + q.largura - e / 2, z0 = q.z + e / 2, z1 = q.z + q.fundo - e / 2;
    faixa(x0, z0, x1, z0, e, y, 0); faixa(x1, z0, x1, z1, e, y, 0); faixa(x1, z1, x0, z1, e, y, 0); faixa(x0, z1, x0, z0, e, y, 0);
  }
  const ruas = montarRuas(planta.quadras);
  for (const [ax, az, bx, bz] of ruas) faixa(ax, az, bx, bz, 0.2, 0.012, 1, Math.random() * 10);
  const geoFaixa = guardar(new THREE.BufferGeometry());
  geoFaixa.setAttribute('position', new THREE.Float32BufferAttribute(vertsFaixa, 3));
  geoFaixa.setAttribute('uv', new THREE.Float32BufferAttribute(uvsFaixa, 2));
  geoFaixa.setAttribute('aDist', new THREE.Float32BufferAttribute(distFaixa, 1));
  geoFaixa.setAttribute('aTipo', new THREE.Float32BufferAttribute(tipoFaixa, 1));
  geoFaixa.setIndex(idxFaixa);
  const apagarFaixas = { value: 0 };
  const faixas = new THREE.Mesh(geoFaixa, guardar(new THREE.ShaderMaterial({
    vertexShader: S.faixaVertex, fragmentShader: S.faixaFragment, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: comNevoa({ uTempo: tempo, uRua: { value: hdr(COR.rua, 1.6) }, uQuadra: { value: hdr(COR.quadra, 1.5) }, uApagar: apagarFaixas }),
  })));
  cena.add(faixas);

  // ---------- prédios (e o reflexo no chão, com a mesma geometria) ----------
  const n = Math.max(1, planta.predios.length);
  const geoPredio = guardar(new THREE.BoxGeometry(LADO, 1, LADO).translate(0, 0.5, 0));
  const maxMudancas = Math.max(1, ...arquivos.map((a) => a.mudancas));
  const dados = new Float32Array(n * 3), apagado = new Float32Array(n);
  const raioMax = Math.max(1, ...planta.predios.map((b) => Math.hypot(b.x, b.z)));
  planta.predios.forEach((b, i) => {
    dados.set([calorDe(b.p.mudancas, maxMudancas), Math.random(), (Math.hypot(b.x, b.z) / raioMax) * 1.5 + Math.random() * 0.25], i * 3);
  });
  geoPredio.setAttribute('aDados', new THREE.InstancedBufferAttribute(dados, 3));
  const attrApagado = new THREE.InstancedBufferAttribute(apagado, 1);
  geoPredio.setAttribute('aApagado', attrApagado);
  const subida = { value: menosMovimento ? 10 : 0 };
  const uniformesPredio = () => comNevoa({
    uTempo: tempo, uSubida: subida, uCorBase: { value: new THREE.Color(COR.corpo) }, uCorAlto: { value: new THREE.Color(COR.corpoAlto) },
    uBorda: { value: hdr(COR.borda, 1.2) }, uQuente: { value: hdr(COR.quente, 2) }, uLaranja: { value: hdr(COR.laranja, 1.8) },
    uJanelaFria: { value: hdr(COR.janelaFria, 1.5) }, uJanelaQuente: { value: hdr(COR.janelaQuente, 1.5) }, uLua: { value: new THREE.Color(COR.lua) },
  });
  const predios = new THREE.InstancedMesh(geoPredio, guardar(new THREE.ShaderMaterial({
    vertexShader: S.predioVertex, fragmentShader: S.predioFragment, fog: true, uniforms: uniformesPredio(),
  })), n);
  planta.predios.forEach((b, i) => { m.makeScale(1, b.h, 1).setPosition(b.x, CHAO, b.z); predios.setMatrixAt(i, m); });
  predios.count = planta.predios.length;
  predios.computeBoundingSphere();
  cena.add(predios);
  const reflexo = new THREE.InstancedMesh(geoPredio, guardar(new THREE.ShaderMaterial({
    vertexShader: S.predioVertex, fragmentShader: S.predioFragment, fog: true, transparent: true, depthWrite: false,
    defines: { ESPELHO: '' }, uniforms: uniformesPredio(),
  })), n);
  reflexo.instanceMatrix = predios.instanceMatrix;
  reflexo.count = predios.count;
  reflexo.scale.y = -1;
  reflexo.renderOrder = -2;
  reflexo.frustumCulled = false;
  cena.add(reflexo);
  const indice = new Map(planta.predios.map((b, i) => [b.p.caminho, i]));

  // ---------- faróis: os arquivos mais alterados ----------
  const quentes = planta.predios.map((b, i) => ({ b, i, calor: dados[i * 3]! })).filter((x) => x.b.p.mudancas > 0 && x.calor >= 0.55)
    .sort((a, b) => b.calor - a.calor).slice(0, 10);
  const apagarFeixes = { value: 0 };
  const geoFeixe = guardar(new THREE.CylinderGeometry(0.85, 0.12, 1, 28, 1, true).translate(0, 0.5, 0));
  const fases = new Float32Array(Math.max(1, quentes.length));
  quentes.forEach((_, k) => { fases[k] = Math.random(); });
  geoFeixe.setAttribute('aFase', new THREE.InstancedBufferAttribute(fases, 1));
  const feixes = new THREE.InstancedMesh(geoFeixe, guardar(new THREE.ShaderMaterial({
    vertexShader: S.feixeVertex, fragmentShader: S.feixeFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTempo: tempo, uQuente: { value: hdr(COR.quente, 1.4) }, uLaranja: { value: hdr(COR.laranja, 1.2) }, uApagar: apagarFeixes },
  })), Math.max(1, quentes.length));
  const alturaFeixe = tamanho * 0.55;
  quentes.forEach(({ b }, k) => { m.makeScale(1, alturaFeixe, 1).setPosition(b.x, CHAO + b.h, b.z); feixes.setMatrixAt(k, m); });
  feixes.count = quentes.length;
  feixes.frustumCulled = false;
  cena.add(feixes);

  // ---------- halos (brilho falso, direto na tela) ----------
  // um halo suave no alto de cada prédio: violeta/ciano fraco nos calmos, laranja/vermelho forte nos quentes;
  // os faróis ganham um halo grande. Assim a Média brilha sem bloom.
  const posHalo = new Float32Array(n * 3), corHalo = new Float32Array(n * 3), dadosHalo = new Float32Array(n * 3);
  const apagadoHalo = new THREE.BufferAttribute(new Float32Array(n), 1);
  const frio = new THREE.Color(COR.borda), quenteC = new THREE.Color(COR.quente), laranjaC = new THREE.Color(COR.laranja), c = new THREE.Color();
  const farois = new Set(quentes.map((x) => x.i));
  planta.predios.forEach((b, i) => {
    const calor = dados[i * 3]!;
    posHalo.set([b.x, CHAO + 0.05, b.z], i * 3);
    c.copy(frio).multiplyScalar(0.10).lerp(laranjaC.clone().lerp(quenteC, calor).multiplyScalar(0.55), Math.min(1, calor * 1.3));
    if (farois.has(i)) c.copy(quenteC).lerp(laranjaC, 0.3).multiplyScalar(0.8);
    corHalo.set([c.r, c.g, c.b], i * 3);
    dadosHalo.set([farois.has(i) ? 6 : 1.6 + calor * 2.4, b.h, dados[i * 3 + 2]!], i * 3);
  });
  const geoHalo = guardar(new THREE.BufferGeometry());
  geoHalo.setAttribute('position', new THREE.BufferAttribute(posHalo, 3));
  geoHalo.setAttribute('aCor', new THREE.BufferAttribute(corHalo, 3));
  geoHalo.setAttribute('aHalo', new THREE.BufferAttribute(dadosHalo, 3));
  geoHalo.setAttribute('aApagado', apagadoHalo);
  geoHalo.setDrawRange(0, planta.predios.length);
  const alturaTela = { value: 600 };
  const halos = new THREE.Points(geoHalo, guardar(new THREE.ShaderMaterial({
    vertexShader: S.haloVertex, fragmentShader: S.haloFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSubida: subida, uTempo: tempo, uAltura: alturaTela },
  })));
  halos.frustumCulled = false;
  halos.renderOrder = 4;
  cena.add(halos);

  // ---------- tráfego de dados pelas ruas ----------
  const ptsTrafego: [number, number, number, number, number, number, number][] = [];
  for (const [ax, az, bx, bz] of ruas) {
    const comp = Math.hypot(bx - ax, bz - az);
    for (let k = 0; k < Math.min(6, Math.max(1, Math.round(comp / 2.2))); k++) ptsTrafego.push([ax, az, bx, bz, 1.2 + Math.random() * 1.6, Math.random(), Math.random() < 0.5 ? 1 : -1]);
  }
  const nTrafego = Math.min(700, ptsTrafego.length);
  const ini = new Float32Array(Math.max(1, nTrafego) * 3), fim = new Float32Array(Math.max(1, nTrafego) * 3), mov = new Float32Array(Math.max(1, nTrafego) * 2);
  ptsTrafego.slice(0, nTrafego).forEach(([ax, az, bx, bz, vel, fase, sentido], k) => {
    const [a0, a1, b0, b1] = sentido > 0 ? [ax, az, bx, bz] : [bx, bz, ax, az];
    ini.set([a0, 0.09, a1], k * 3); fim.set([b0, 0.09, b1], k * 3); mov.set([vel, fase], k * 2);
  });
  const geoTrafego = guardar(new THREE.BufferGeometry());
  geoTrafego.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, nTrafego) * 3), 3));
  geoTrafego.setAttribute('aIni', new THREE.BufferAttribute(ini, 3));
  geoTrafego.setAttribute('aFim', new THREE.BufferAttribute(fim, 3));
  geoTrafego.setAttribute('aMov', new THREE.BufferAttribute(mov, 2));
  geoTrafego.setDrawRange(0, nTrafego);
  const trafego = new THREE.Points(geoTrafego, guardar(new THREE.ShaderMaterial({
    vertexShader: S.trafegoVertex, fragmentShader: S.trafegoFragment, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: comNevoa({ uTempo: tempo, uPixel: pixel, uCor: { value: new THREE.Color(COR.trafego) } }),
  })));
  trafego.frustumCulled = false;
  cena.add(trafego);

  // ---------- névoa em camadas ----------
  const camadas = [1.4, 3.8].map((y, k) => {
    const c = new THREE.Mesh(guardar(new THREE.PlaneGeometry(raio * 2.6, raio * 2.6).rotateX(-Math.PI / 2)), guardar(new THREE.ShaderMaterial({
      vertexShader: S.nevoaVertex, fragmentShader: S.nevoaFragment, transparent: true, depthWrite: false,
      uniforms: { uTempo: tempo, uRaio: { value: raio * 1.2 }, uCor: { value: new THREE.Color(k ? '#3a2a8a' : '#2a2370') }, uForca: { value: k ? 0.1 : 0.16 } },
    })));
    c.position.y = y;
    c.renderOrder = 5;
    cena.add(c);
    return c;
  });

  // ---------- contorno ao passar o mouse e no escolhido ----------
  const geoContorno = guardar(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const contorno = (cor: THREE.Color) => {
    const c = new THREE.Mesh(geoContorno, guardar(new THREE.MeshBasicMaterial({ color: cor, side: THREE.BackSide, transparent: true, opacity: 0.95, depthWrite: false, fog: false, toneMapped: false })));
    c.visible = false; c.renderOrder = 3; cena.add(c); return c;
  };
  const contornoMouse = contorno(hdr(COR.realce, 1.6));
  const contornoEscolhido = contorno(hdr(COR.escolhido, 1.4));
  const colocarContorno = (c: THREE.Mesh, i: number) => {
    if (i < 0) { c.visible = false; return; }
    const b = planta.predios[i]!;
    c.visible = true; c.position.set(b.x, CHAO - 0.02, b.z); c.scale.set(1.14, b.h + 0.1, 1.14);
  };

  // ---------- nomes dos bairros (texto de verdade, por cima do 3D, sem se sobrepor) ----------
  const camadaRotulos = document.createElement('div');
  camadaRotulos.className = 'cidade-rotulos';
  camadaRotulos.setAttribute('aria-hidden', 'true');
  caixa.append(camadaRotulos);
  const maisAlto = planta.quadras.map(() => 0);
  for (const b of planta.predios) maisAlto[b.quadra] = Math.max(maisAlto[b.quadra]!, b.h);
  const rotulos = planta.quadras.map((q, i) => ({ q, i, peso: q.lista.length + (q.nome === '' ? 1000 : 0), el: document.createElement('span'), w: 0, h: 0,
    ponto: new THREE.Vector3(q.x + q.largura / 2, CHAO + maisAlto[i]! + 0.9, q.z + q.fundo / 2), apagado: false }))
    .sort((a, b) => b.peso - a.peso).slice(0, 80);
  for (const r of rotulos) {
    const nome = r.q.nome === '' ? 'raiz do projeto' : r.q.nome.slice(r.q.nome.lastIndexOf('/') + 1);
    const partes = r.q.nome.split('/');
    const mae = partes.length > 1 ? `${partes.at(-2)}/` : ''; // só a pasta de cima, para o rótulo ficar curto
    r.el.className = 'cidade-rotulo';
    if (mae) { const s = document.createElement('small'); s.textContent = mae; r.el.append(s); }
    const b = document.createElement('b'); b.textContent = nome; r.el.append(b);
    camadaRotulos.append(r.el);
  }
  let medidos = false;
  const vet = new THREE.Vector3();
  function posicionarRotulos() {
    const w = caixa.clientWidth, h = caixa.clientHeight;
    if (!medidos) { for (const r of rotulos) { r.w = r.el.offsetWidth; r.h = r.el.offsetHeight; } medidos = true; }
    const ocupados: [number, number, number, number][] = [];
    const maximo = w < 640 ? 6 : 12; // poucos nomes, os dos maiores bairros: o resto aparece ao aproximar
    for (const r of rotulos) {
      vet.copy(r.ponto).project(camera);
      const x = (vet.x * 0.5 + 0.5) * w, y = (-vet.y * 0.5 + 0.5) * h;
      const ret: [number, number, number, number] = [x - r.w / 2 - 4, y - r.h - 4, x + r.w / 2 + 4, y + 4];
      const dentro = vet.z < 1 && ret[0] > 4 && ret[2] < w - 4 && ret[1] > (w < 640 ? 100 : 52) && y < h - 8; // fora do HUD
      const livre = dentro && ocupados.length < maximo && !ocupados.some((o) => o[0] < ret[2] && ret[0] < o[2] && o[1] < ret[3] && ret[1] < o[3]);
      if (livre) ocupados.push(ret);
      r.el.style.transform = `translate(${Math.round(x - r.w / 2)}px, ${Math.round(y - r.h)}px)`;
      r.el.classList.toggle('visivel', livre);
      r.el.classList.toggle('apagado', r.apagado);
    }
  }

  // ---------- câmera, controles e pós-processamento ----------
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, tamanho * 20);
  const alturaMax = Math.max(1, ...planta.predios.map((b) => b.h));
  const raioCidade = Math.hypot(planta.largura / 2, planta.fundo / 2, alturaMax / 2);
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = !menosMovimento;
  controles.dampingFactor = 0.08;
  controles.minDistance = 3;
  controles.maxDistance = tamanho * 4;
  controles.maxPolarAngle = Math.PI * 0.46; // a câmera nunca desce abaixo do chão
  controles.screenSpacePanning = false;
  controles.autoRotateSpeed = 0.35;
  const distanciaIdeal = () => {
    const meiaVista = THREE.MathUtils.degToRad(camera.fov / 2);
    const meiaLargura = Math.atan(Math.tan(meiaVista) * camera.aspect);
    return (raioCidade / Math.sin(Math.min(meiaVista, meiaLargura))) * 0.68;
  };
  const final = { pos: new THREE.Vector3(), alvo: new THREE.Vector3(0, alturaMax * 0.12, 0) };
  // câmera baixa (uns 25 graus), como quem olha a cidade de um prédio vizinho
  const calcularFinal = () => { const d = distanciaIdeal(); final.pos.set(d * 0.6, d * 0.42, d * 0.68); };

  // ---------- diagnóstico (sem dados pessoais: placa de vídeo, recursos do WebGL, qualidade e erros) ----------
  const gl = renderer.getContext();
  const infoPlaca = gl.getExtension('WEBGL_debug_renderer_info');
  const placa = String(infoPlaca ? gl.getParameter(infoPlaca.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 120);
  // O bloom desenha antes numa imagem fora da tela, em ponto flutuante. Placas que não aceitam esse formato (ou o
  // antisserrilhado nele) devolvem um quadro vazio: os prédios somem e só os nomes (que são HTML) ficam. Por isso o
  // formato e as amostras dependem do que a placa diz aceitar, e o bloom só liga quando ela aceita.
  const bufferFloat = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const amostras = bufferFloat ? Math.min(4, renderer.capabilities.maxSamples) : 0;
  const errosGl: string[] = [];
  renderer.debug.onShaderError = (glc, programa, vs, fs) => {
    const log = (glc.getProgramInfoLog(programa) || glc.getShaderInfoLog(fs) || glc.getShaderInfoLog(vs) || 'erro de shader').trim().slice(0, 300);
    errosGl.push(log);
    console.warn('[Gyde · Cidade 3D] um shader não compilou:', log);
  };
  const aoPerderContexto = () => { errosGl.push('contexto WebGL perdido'); console.warn('[Gyde · Cidade 3D] a placa de vídeo descartou a cena (contexto WebGL perdido)'); };
  renderer.domElement.addEventListener('webglcontextlost', aoPerderContexto);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: bufferFloat ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: amostras }));
  composer.addPass(new RenderPass(cena, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- qualidade adaptativa ----------
  const ORDEM: Qualidade[] = ['leve', 'media', 'alta'];
  let qualidade: Qualidade = 'media';
  let forcaBloom = 0.75;
  let automatica = (opcoes.qualidade ?? 'auto') === 'auto';
  function aplicarQualidade(q: Qualidade) {
    qualidade = q;
    const dpr = Math.min(devicePixelRatio, q === 'alta' ? 1.75 : q === 'media' ? 1.5 : 1);
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
    pixel.value = dpr;
    // só a Alta usa o bloom (imagem fora da tela); Leve e Média desenham direto na tela
    bloom.enabled = q === 'alta' && bufferFloat;
    forcaBloom = 0.75;
    halos.visible = q !== 'leve';
    trafego.visible = q !== 'leve' && nTrafego > 0;
    geoTrafego.setDrawRange(0, nTrafego);
    for (const camada of camadas) camada.visible = q !== 'leve';
    reflexo.visible = q !== 'leve';
    estrelas.visible = q !== 'leve';
    ajustar();
    aoQualidade?.(q, automatica);
    agendarVerificacao();
  }

  // ---------- checagem de segurança: o quadro saiu com prédios? ----------
  // Desenha o mesmo quadro com e sem os prédios e compara alguns pixels onde eles deveriam estar. Se não muda nada,
  // os prédios não estão aparecendo nesta qualidade (placa de vídeo, driver): baixa um nível e avisa.
  const NOME: Record<Qualidade, string> = { alta: 'alta', media: 'média', leve: 'leve' };
  const verificacao = { em: -1, tentativas: 0 };
  // só para o teste automático provar o recuo: finge que a qualidade alta não mostra os prédios
  const simularFalha = (() => { try { return localStorage.getItem('gyde-teste-cidade-falha') === 'alta'; } catch { return false; } })();
  function agendarVerificacao() { verificacao.em = menosMovimento ? 0 : relogio.getElapsedTime() + 0.6; verificacao.tentativas = 0; desenhar(); }
  const pontosConferir = [...planta.predios].sort((a, b) => b.h - a.h).slice(0, 80).map((b) => new THREE.Vector3(b.x, CHAO + b.h * 0.5, b.z));
  function renderizar() {
    // (a falha simulada esconde prédios e reflexo, como uma placa que não desenha a cena 3D)
    const esconder = simularFalha && qualidade === 'alta' && predios.visible;
    const reflexoAntes = reflexo.visible;
    if (esconder) { predios.visible = false; reflexo.visible = false; }
    if (bloom.enabled) {
      // de perto, as janelas ocupam a tela e o bloom vira um véu: ele enfraquece com a aproximação
      bloom.strength = forcaBloom * THREE.MathUtils.clamp(camera.position.distanceTo(controles.target) / (distanciaIdeal() * 0.75), 0.25, 1);
      composer.render();
    } else renderer.render(cena, camera);
    if (esconder) { predios.visible = true; reflexo.visible = reflexoAntes; }
  }
  // material de teste: os prédios pintados de magenta puro. Se o magenta não chega à tela, a geometria dos prédios
  // não está sendo desenhada (pipeline/placa). Se chega, mas o quadro normal fica igual ao quadro sem prédios (ou preto),
  // o shader dos prédios é que não aparece. Assim a checagem pega também prédios que existem mas não aparecem.
  const matTeste = guardar(new THREE.MeshBasicMaterial({ color: 0xff00ff, fog: false, toneMapped: false }));
  const historico: string[] = [];
  const px = new Uint8Array(4);
  const amostrar = (pts: [number, number][]) => pts.map(([x, y]) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0]!, px[1]!, px[2]!]; });
  function verificarQuadro() {
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2());
    const pts: [number, number][] = [];
    for (const p of pontosConferir) {
      vet.copy(p).project(camera);
      if (vet.z < 1 && Math.abs(vet.x) < 0.95 && Math.abs(vet.y) < 0.95) pts.push([Math.floor((vet.x * 0.5 + 0.5) * tam.x), Math.floor((vet.y * 0.5 + 0.5) * tam.y)]);
      if (pts.length >= 24) break;
    }
    if (pts.length < Math.min(6, pontosConferir.length) || !pts.length) return null; // quase nenhum prédio à vista neste ângulo: confere depois
    const com = amostrar(pts);
    const refl = reflexo.visible, hal = halos.visible, materialReal = predios.material;
    const comoMaterial = predios as unknown as { material: THREE.Material }; // troca temporária pelo material de teste
    predios.visible = false; reflexo.visible = false; halos.visible = false;
    renderizar();
    const sem = amostrar(pts);
    predios.visible = true; comoMaterial.material = matTeste;
    renderizar();
    const teste = amostrar(pts);
    predios.material = materialReal; reflexo.visible = refl; halos.visible = hal;
    renderizar(); // a tela fica com o quadro normal
    let diferenca = 0, maximo = 0, magenta = 0;
    com.forEach((c, i) => {
      const o = sem[i]!, t = teste[i]!;
      diferenca += Math.abs(c[0]! - o[0]!) + Math.abs(c[1]! - o[1]!) + Math.abs(c[2]! - o[2]!);
      maximo = Math.max(maximo, ...c);
      if (t[0]! > 120 && t[2]! > 120 && t[1]! < Math.min(t[0]!, t[2]!) * 0.6) magenta++;
    });
    diferenca /= pts.length * 3;
    const fracaoMagenta = magenta / pts.length;
    const motivo = fracaoMagenta < 0.5 ? 'a geometria dos prédios não chega à tela' : maximo <= 2 ? 'quadro preto' : diferenca <= 1.5 ? 'o shader dos prédios sai igual ao fundo' : '';
    return { ok: !motivo, motivo, diferenca: Math.round(diferenca * 10) / 10, magenta: Math.round(fracaoMagenta * 100), quadroPreto: maximo <= 2, pontos: pts.length };
  }
  function tratarVerificacao(r: NonNullable<ReturnType<typeof verificarQuadro>>) {
    const diag = { placa, qualidade, bloom: bloom.enabled, bufferFloat, amostras, diferenca: r.diferenca, magenta: `${r.magenta}%`, motivo: r.motivo || 'nenhum', errosShader: errosGl.length };
    historico.push(`${NOME[qualidade]}: ${r.ok ? 'prédios aparecendo' : `falhou (${r.motivo})`}; diferença ${r.diferenca}; magenta ${r.magenta}% de ${r.pontos} pontos`);
    if (r.ok) { caixa.dataset.verificacao = 'ok'; console.info('[Gyde · Cidade 3D] quadro conferido: prédios aparecendo', diag); return; }
    console.warn('[Gyde · Cidade 3D] os prédios não apareceram neste quadro', diag, errosGl.slice(0, 3));
    const i = ORDEM.indexOf(qualidade);
    if (i > 0) {
      const de = qualidade, para = ORDEM[i - 1]!;
      caixa.dataset.verificacao = `recuou-${para}`;
      aplicarQualidade(para);
      aoAviso?.(`Os prédios não apareceram na qualidade ${NOME[de]} nesta placa de vídeo. Mudei para a ${NOME[para]}.`, false);
    } else {
      caixa.dataset.verificacao = 'falhou';
      aoAviso?.('Esta placa de vídeo não conseguiu mostrar os prédios em 3D. Use a Lista para ver os mesmos dados.', true);
    }
  }

  // ---------- laço de desenho ----------
  const inicioRelogio = performance.now();
  const relogio = { getElapsedTime: () => (performance.now() - inicioRelogio) / 1000 }; // segundos desde que a cena abriu
  let quadro = 0, visivelNaTela = true, ultimoMexer = -1e9, interagindo = false;
  const entrada = { ativa: !menosMovimento, inicio: 0 };
  let voo: { de: THREE.Vector3; para: THREE.Vector3; alvoDe: THREE.Vector3; alvoPara: THREE.Vector3; inicio: number } | null = null;
  const medidor = { quadros: 0, inicio: 0 };
  const eixoY = new THREE.Vector3(0, 1, 0);
  function desenhar() { if (!quadro && visivelNaTela && !document.hidden) quadro = requestAnimationFrame(passo); }
  function passo() {
    quadro = 0;
    const agora = relogio.getElapsedTime();
    let continuar = !menosMovimento; // pulsos, tráfego e órbita lenta pedem desenho contínuo
    if (!menosMovimento) { tempo.value = agora; subida.value = Math.min((agora - entrada.inicio) * 1.15, 10); }
    if (entrada.ativa) {
      const t = Math.min(1, (agora - entrada.inicio) / 3.4), s = 1 - (1 - t) ** 3;
      camera.position.copy(final.pos).sub(final.alvo).applyAxisAngle(eixoY, (1 - s) * -1.2).multiplyScalar(THREE.MathUtils.lerp(1.45, 1, s)).add(final.alvo);
      camera.position.y = THREE.MathUtils.lerp(final.pos.y * 1.6, final.pos.y, s);
      controles.target.copy(final.alvo);
      if (t >= 1) entrada.ativa = false;
    }
    if (voo) {
      const t = Math.min(1, (performance.now() - voo.inicio) / 1100), s = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      camera.position.lerpVectors(voo.de, voo.para, s); controles.target.lerpVectors(voo.alvoDe, voo.alvoPara, s);
      if (t < 1) continuar = true; else voo = null;
    }
    // órbita lenta quando ninguém mexe há alguns segundos (pausa ao interagir)
    controles.autoRotate = !menosMovimento && !interagindo && !entrada.ativa && !voo && agora - ultimoMexer > 6;
    if (controles.update()) continuar = true;
    renderizar();
    posicionarRotulos();
    // confere depois que a entrada terminou (prédios já de pé) e a câmera parou de voar
    if (verificacao.em >= 0 && agora >= verificacao.em && !entrada.ativa && !voo && subida.value >= 3) {
      verificacao.em = -1;
      const r = verificarQuadro();
      if (r) tratarVerificacao(r);
      else if (++verificacao.tentativas < 6) { verificacao.em = agora + 2; continuar = true; }
      else { caixa.dataset.verificacao = 'sem-conferir'; historico.push(`${NOME[qualidade]}: não deu para conferir (poucos prédios à vista)`); console.info('[Gyde · Cidade 3D] não deu para conferir o quadro: poucos prédios à vista'); }
    } else if (verificacao.em >= 0) continuar = true;
    // mede o FPS e alivia a cena se ficar pesada (só no automático)
    if (automatica && !menosMovimento) {
      medidor.quadros++;
      if (medidor.quadros === 1) medidor.inicio = agora;
      else if (agora - medidor.inicio > 2.5) {
        const fps = (medidor.quadros - 1) / (agora - medidor.inicio);
        medidor.quadros = 0;
        const i = ORDEM.indexOf(qualidade);
        if (fps < 38 && i > 0) aplicarQualidade(ORDEM[i - 1]!);
      }
    }
    if (continuar) desenhar();
  }
  controles.addEventListener('change', desenhar);
  controles.addEventListener('start', () => { interagindo = true; entrada.ativa = false; voo = null; });
  controles.addEventListener('end', () => { interagindo = false; ultimoMexer = relogio.getElapsedTime(); desenhar(); });

  function ajustar() {
    const { width, height } = caixa.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    alturaTela.value = height * renderer.getPixelRatio();
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    medidos = false;
    desenhar();
  }
  let enquadrada = false;
  const observador = new ResizeObserver(() => {
    ajustar();
    if (!enquadrada && caixa.clientWidth) {
      enquadrada = true; calcularFinal();
      camera.position.copy(final.pos); controles.target.copy(final.alvo); controles.update();
      entrada.inicio = relogio.getElapsedTime();
    }
  });
  observador.observe(caixa);
  const naTela = new IntersectionObserver(([e]) => { visivelNaTela = Boolean(e?.isIntersecting); desenhar(); });
  naTela.observe(caixa);
  const aoMudarAba = () => desenhar();
  document.addEventListener('visibilitychange', aoMudarAba);

  // ---------- mouse e toque ----------
  const raioMouse = new THREE.Raycaster();
  const ponto = new THREE.Vector2();
  let selecionado = -1, sobMouse = -1;
  function predioEm(ev: PointerEvent): number {
    const r = renderer.domElement.getBoundingClientRect();
    ponto.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raioMouse.setFromCamera(ponto, camera);
    return raioMouse.intersectObject(predios, false)[0]?.instanceId ?? -1;
  }
  let apertou: { x: number; y: number } | null = null;
  const aoApertar = (ev: PointerEvent) => { apertou = { x: ev.clientX, y: ev.clientY }; };
  const aoSoltar = (ev: PointerEvent) => {
    if (!apertou || Math.hypot(ev.clientX - apertou.x, ev.clientY - apertou.y) > 6) { apertou = null; return; } // foi arrasto
    apertou = null;
    const i = predioEm(ev);
    const p = i >= 0 ? planta.predios[i]!.p : null;
    api.selecionar(p?.caminho ?? null);
    if (p) api.focar(p.caminho);
    aoEscolher(p);
  };
  const aoMover = (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    const i = predioEm(ev);
    if (i !== sobMouse) { sobMouse = i; colocarContorno(contornoMouse, i === selecionado ? -1 : i); desenhar(); }
    renderer.domElement.style.cursor = i >= 0 ? 'pointer' : '';
    aoPassar(i >= 0 ? planta.predios[i]!.p : null, ev.clientX, ev.clientY);
  };
  const aoSair = () => { if (sobMouse >= 0) { sobMouse = -1; colocarContorno(contornoMouse, -1); desenhar(); } aoPassar(null, 0, 0); };
  renderer.domElement.addEventListener('pointerdown', aoApertar);
  renderer.domElement.addEventListener('pointerup', aoSoltar);
  renderer.domElement.addEventListener('pointermove', aoMover);
  renderer.domElement.addEventListener('pointerleave', aoSair);

  const api: Cidade3D = {
    destruir() {
      cancelAnimationFrame(quadro);
      observador.disconnect(); naTela.disconnect(); document.removeEventListener('visibilitychange', aoMudarAba);
      renderer.domElement.removeEventListener('webglcontextlost', aoPerderContexto);
      controles.dispose();
      for (const d of descartar) d.dispose();
      lajes.dispose(); predios.dispose(); reflexo.dispose(); feixes.dispose();
      halos.geometry.dispose();
      composer.dispose(); bloom.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); camadaRotulos.remove();
    },
    selecionar(caminho) {
      selecionado = caminho == null ? -1 : (indice.get(caminho) ?? -1);
      colocarContorno(contornoEscolhido, selecionado);
      if (sobMouse === selecionado) colocarContorno(contornoMouse, -1);
      desenhar();
    },
    focar(caminho) {
      const i = indice.get(caminho);
      if (i == null) return;
      const b = planta.predios[i]!;
      const alvoPara = new THREE.Vector3(b.x, CHAO + b.h * 0.55, b.z);
      const distancia = Math.max(12, b.h * 2.6 + 7); // perto o bastante para ver as janelas, longe o bastante para ver o bairro
      const direcao = camera.position.clone().sub(controles.target).setY(0).normalize();
      const para = alvoPara.clone().add(direcao.multiplyScalar(distancia)).setY(alvoPara.y + distancia * 0.5);
      entrada.ativa = false;
      ultimoMexer = relogio.getElapsedTime();
      if (menosMovimento) { camera.position.copy(para); controles.target.copy(alvoPara); controles.update(); desenhar(); return; }
      voo = { de: camera.position.clone(), para, alvoDe: controles.target.clone(), alvoPara, inicio: performance.now() };
      desenhar();
    },
    filtrar(termo) {
      const t = termo.trim().toLowerCase();
      let combinam = 0;
      const bairrosVivos = new Set<number>();
      planta.predios.forEach((b, i) => {
        const ok = !t || b.p.caminho.toLowerCase().includes(t);
        apagado[i] = ok ? 0 : 1;
        if (ok) { combinam++; bairrosVivos.add(b.quadra); }
      });
      attrApagado.needsUpdate = true;
      (apagadoHalo.array as Float32Array).set(apagado);
      apagadoHalo.needsUpdate = true;
      apagarFaixas.value = t ? 1 : 0;
      apagarFeixes.value = t ? 1 : 0;
      for (const r of rotulos) r.apagado = Boolean(t) && !bairrosVivos.has(r.i);
      desenhar();
      return combinam;
    },
    definirQualidade(q) {
      automatica = q === 'auto';
      medidor.quadros = 0;
      aplicarQualidade(q === 'auto' ? (celular ? 'leve' : 'media') : q);
    },
    diagnostico() {
      const tela = renderer.getDrawingBufferSize(new THREE.Vector2());
      return [
        'Gyde · Cidade 3D · diagnóstico',
        `Placa de vídeo: ${placa}`,
        `WebGL: ${renderer.capabilities.isWebGL2 ? '2' : '1'} · imagem em ponto flutuante: ${bufferFloat ? 'aceita' : 'não aceita'} · antisserrilhado fora da tela: ${amostras} amostras (máx. ${renderer.capabilities.maxSamples}) · textura máx.: ${renderer.capabilities.maxTextureSize}`,
        `Qualidade: ${NOME[qualidade]} (${automatica ? 'automática' : 'escolhida'}) · bloom: ${bloom.enabled ? 'ligado' : 'desligado'} · desenho: ${bloom.enabled ? 'imagem fora da tela' : 'direto na tela'}`,
        `Tela: ${tela.x}×${tela.y} px · densidade ${renderer.getPixelRatio()} · celular: ${celular ? 'sim' : 'não'} · menos movimento: ${menosMovimento ? 'sim' : 'não'}`,
        `Prédios: ${planta.predios.length} · bairros: ${planta.quadras.length} · faróis: ${quentes.length}`,
        `Checagens: ${historico.length ? historico.join(' | ') : 'ainda não feita'}`,
        `Erros: ${errosGl.length ? errosGl.slice(0, 5).join(' | ') : 'nenhum'}`,
      ].join('\n');
    },
  };

  console.info('[Gyde · Cidade 3D] início', { placa, bufferFloat, amostras, qualidade: opcoes.qualidade ?? 'auto', celular, menosMovimento, predios: planta.predios.length });
  aplicarQualidade(automatica ? (celular ? 'leve' : 'media') : (opcoes.qualidade as Qualidade));
  if (menosMovimento) tempo.value = 1.7;
  desenhar();
  return api;
}
