// Cidade do código em 3D (Three.js). Este arquivo só é baixado quando a aba Cidade abre (import dinâmico em Cidade.svelte).
// Direção de arte: cidade noturna em neon. Pasta = bairro (quadra com borda acesa), arquivo = prédio com janelas,
// altura = tamanho, calor = quantas vezes mudou no git (os mais alterados viram faróis vermelho/laranja).
// Ruas ligam cada bairro à pasta-mãe, com "tráfego de dados" correndo por elas.
// Um visual só: a base desenha direto na tela (sem imagem fora da tela) e roda em placa integrada (referência:
// Intel UHD 620). Em computador mais forte, extras ligam sozinhos e em silêncio (bloom de verdade, mais nitidez),
// só depois de passar na checagem de segurança, e desligam se o FPS cair. Se a máquina sofrer, a base se alivia.
// Abertura: escuro; a cidade acende bairro por bairro, os prédios sobem em onda e a câmera desce do alto.
// A cidade reage à Forja: o prédio do arquivo lido, editado, criado ou apagado acende e pulsa na hora.
// Com "menos movimento" não há abertura, órbita, pulsos nem voo de câmera, e a cena só desenha quando algo muda.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { TPredio } from '$contratos';
import { calorDe, bairroDe, faroisDe } from './cidade-comum.ts';
import type { SinalCidade } from './sinais-cidade.ts';
import * as S from './cidade3d-shaders.ts';

export interface Cidade3D {
  destruir(): void;
  selecionar(caminho: string | null): void; // destaca um prédio (ou nenhum)
  focar(caminho: string): void; // leva a câmera até o prédio
  filtrar(termo: string): number; // escurece o que não combina; devolve quantos combinam
  reagir(sinal: SinalCidade): boolean; // a Forja mexeu num arquivo; devolve se o prédio existe (ou foi criado)
  pausar(sim: boolean): void; // em segundo plano (ex.: Ao vivo aberto ao lado): só desenha quando algo muda
  diagnostico(): string; // texto para copiar (placa, formatos, checagens, extras, erros; nada pessoal)
}
interface Opcoes {
  aoEscolher: (p: TPredio | null) => void; // clique (ou toque) num prédio, ou no vazio
  aoPassar: (p: TPredio | null, x: number, y: number) => void; // mouse em cima de um prédio
  aoAviso?: (texto: string, grave: boolean) => void; // só para o caso grave (nem a base mostrou os prédios)
}

const CELULA = 1.6; // espaço de cada prédio na quadra
const LADO = 1; // largura do prédio
const MARGEM = 0.9; // borda da quadra em volta dos prédios
const RUA = 1.6; // espaço entre quadras
const CHAO = 0.06; // altura da laje das quadras
const NOVOS = 64; // vagas para prédios que a Forja criar com a cidade aberta
const ABERTURA = 5.2; // segundos da abertura (câmera)
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
    q.lista.forEach((p, i) => predios.push({ p, h: alturaDe(p), quadra: iq, ...posicaoNaQuadra(q, i) }));
  });
  return { quadras, predios, largura: larguraTotal, fundo: fundoTotal };
}
const posicaoNaQuadra = (q: { x: number; z: number; colunas: number }, i: number) =>
  ({ x: q.x + MARGEM + (i % q.colunas) * CELULA + LADO / 2, z: q.z + MARGEM + Math.floor(i / q.colunas) * CELULA + LADO / 2 });

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

// caminho como a Forja manda ("./src\\app.js") no formato da cidade ("src/app.js")
export const normalizarCaminho = (c: string) => c.replaceAll('\\', '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '');

// paleta: azul-marinho e violeta de base, ciano nas ruas, janelas âmbar e ciano, calor em laranja e vermelho;
// eventos da Forja: ciano (leu), verde-limão (editou ou criou), vermelho-rosa (apagou). Valores acima de 1 brilham.
const COR = {
  ceuHorizonte: '#211650', ceuMeio: '#110c31', ceuTopo: '#04040f', nevoa: '#211650', // névoa = cor do horizonte: o chão some no céu sem faixa
  corpo: '#0e1336', corpoAlto: '#2a2068', borda: '#7c5cff', lua: '#9db4ff',
  quente: '#ff2a3d', laranja: '#ff8a1f', janelaFria: '#7fe3ff', janelaQuente: '#ffd27a',
  rua: '#2fd9ff', quadra: '#8b6cff', trafego: '#9ff3ff', chao: '#05061a', chaoBrilho: '#3b1f8f', grade: '#3a3f9e',
  realce: '#5ee7ff', escolhido: '#ffffff', ler: '#38e8ff', editar: '#8dff5a', apagar: '#ff3d7f',
};
const hdr = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);
const CHAVE_EXTRAS = 'gyde-cidade-extras-falharam'; // placas em que o bloom já falhou (não tenta de novo)

export function criarCidade3D(caixa: HTMLElement, arquivos: TPredio[], opcoes: Opcoes): Cidade3D {
  const { aoEscolher, aoPassar, aoAviso } = opcoes;
  const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const celular = matchMedia('(pointer: coarse)').matches || caixa.clientWidth < 640;
  const teste = (chave: string) => { try { return localStorage.getItem(chave); } catch { return null; } };
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); // sem WebGL, lança erro e a tela oferece a lista
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'cidade-canvas';
  caixa.append(renderer.domElement);

  const cena = new THREE.Scene();
  const planta = montarPlanta(arquivos);
  const tamanho = Math.max(planta.largura, planta.fundo, 12);
  const raio = Math.hypot(planta.largura, planta.fundo) / 2 + 4;
  cena.fog = new THREE.FogExp2(new THREE.Color(COR.nevoa), 0.55 / (tamanho * 1.6));
  const descartar: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(x: T) => { descartar.push(x); return x; };
  const comNevoa = (u: Record<string, THREE.IUniform>) => ({ ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...u });
  const tempo = { value: 0 };
  const subida = { value: menosMovimento ? 100 : 0 }; // segundos desde que a cidade abriu (a abertura inteira lê daqui)
  const luz = { value: menosMovimento ? 1 : 0 }; // céu, chão e névoa acendendo
  const movimento = { value: menosMovimento ? 0 : 1 };

  // ---------- ordem da abertura: bairros do centro para fora, prédios em onda dentro do bairro ----------
  const nq = planta.quadras.length;
  const ordemQuadra = new Map([...planta.quadras.keys()].sort((a, b) => {
    const qa = planta.quadras[a]!, qb = planta.quadras[b]!;
    return Math.hypot(qa.x + qa.largura / 2, qa.z + qa.fundo / 2) - Math.hypot(qb.x + qb.largura / 2, qb.z + qb.fundo / 2);
  }).map((iq, k) => [iq, k]));
  const atrasoQuadra = (iq: number) => 0.5 + (nq > 1 ? (ordemQuadra.get(iq)! / (nq - 1)) * 2.3 : 0);

  // ---------- céu e estrelas ----------
  const ceu = new THREE.Mesh(guardar(new THREE.SphereGeometry(tamanho * 8, 32, 16)), guardar(new THREE.ShaderMaterial({
    vertexShader: S.ceuVertex, fragmentShader: S.ceuFragment, side: THREE.BackSide, depthWrite: false,
    uniforms: { uHorizonte: { value: new THREE.Color(COR.ceuHorizonte) }, uMeio: { value: new THREE.Color(COR.ceuMeio) }, uTopo: { value: new THREE.Color(COR.ceuTopo) }, uLuz: luz },
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
  const chao = new THREE.Mesh(guardar(new THREE.PlaneGeometry(tamanho * 16, tamanho * 16).rotateX(-Math.PI / 2)), guardar(new THREE.ShaderMaterial({
    vertexShader: S.chaoVertex, fragmentShader: S.chaoFragment, fog: true, transparent: true,
    uniforms: comNevoa({ uRaio: { value: raio }, uLuz: luz, uFundo: { value: new THREE.Color(COR.chao) }, uBrilho: { value: new THREE.Color(COR.chaoBrilho) }, uGrade: { value: new THREE.Color(COR.grade) } }),
  })));
  chao.renderOrder = -1;
  cena.add(chao);

  // ---------- quadras: laje escura ----------
  const m = new THREE.Matrix4();
  const lajes = new THREE.InstancedMesh(guardar(new THREE.BoxGeometry(1, CHAO, 1).translate(0, CHAO / 2, 0)),
    guardar(new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c1030') })), Math.max(1, nq));
  planta.quadras.forEach((q, i) => { m.makeScale(q.largura, 1, q.fundo).setPosition(q.x + q.largura / 2, 0, q.z + q.fundo / 2); lajes.setMatrixAt(i, m); });
  lajes.count = nq;
  cena.add(lajes);

  // ---------- faixas de neon: bordas das quadras e ruas (uma malha só) ----------
  const vertsFaixa: number[] = [], uvsFaixa: number[] = [], distFaixa: number[] = [], tipoFaixa: number[] = [], atrasoFaixa: number[] = [], idxFaixa: number[] = [];
  const faixa = (ax: number, az: number, bx: number, bz: number, largura: number, y: number, tipo: number, atraso: number, dist0 = 0) => {
    const dx = bx - ax, dz = bz - az, comp = Math.hypot(dx, dz);
    if (comp < 0.01) return;
    const nx = (-dz / comp) * largura / 2, nz = (dx / comp) * largura / 2;
    const base = vertsFaixa.length / 3;
    vertsFaixa.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
    uvsFaixa.push(0, 0, 0, 1, 1, 0, 1, 1);
    distFaixa.push(dist0, dist0, dist0 + comp, dist0 + comp);
    tipoFaixa.push(tipo, tipo, tipo, tipo);
    atrasoFaixa.push(atraso, atraso, atraso, atraso);
    idxFaixa.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  };
  planta.quadras.forEach((q, iq) => {
    const y = CHAO + 0.004, e = 0.09, x0 = q.x + e / 2, x1 = q.x + q.largura - e / 2, z0 = q.z + e / 2, z1 = q.z + q.fundo - e / 2, a = atrasoQuadra(iq) - 0.25;
    faixa(x0, z0, x1, z0, e, y, 0, a); faixa(x1, z0, x1, z1, e, y, 0, a); faixa(x1, z1, x0, z1, e, y, 0, a); faixa(x0, z1, x0, z0, e, y, 0, a);
  });
  // as ruas acendem depois dos bairros: a rede "conecta" a cidade no fim da abertura
  const ruas = montarRuas(planta.quadras);
  for (const [ax, az, bx, bz] of ruas) faixa(ax, az, bx, bz, 0.2, 0.012, 1, 2.9 + Math.hypot(ax, az) / raio * 0.6, Math.random() * 10);
  const geoFaixa = guardar(new THREE.BufferGeometry());
  geoFaixa.setAttribute('position', new THREE.Float32BufferAttribute(vertsFaixa, 3));
  geoFaixa.setAttribute('uv', new THREE.Float32BufferAttribute(uvsFaixa, 2));
  geoFaixa.setAttribute('aDist', new THREE.Float32BufferAttribute(distFaixa, 1));
  geoFaixa.setAttribute('aTipo', new THREE.Float32BufferAttribute(tipoFaixa, 1));
  geoFaixa.setAttribute('aAtraso', new THREE.Float32BufferAttribute(atrasoFaixa, 1));
  geoFaixa.setIndex(idxFaixa);
  const apagarFaixas = { value: 0 };
  const faixas = new THREE.Mesh(geoFaixa, guardar(new THREE.ShaderMaterial({
    vertexShader: S.faixaVertex, fragmentShader: S.faixaFragment, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: comNevoa({ uTempo: tempo, uSubida: subida, uRua: { value: hdr(COR.rua, 1.6) }, uQuadra: { value: hdr(COR.quadra, 1.5) }, uApagar: apagarFaixas }),
  })));
  cena.add(faixas);

  // ---------- prédios (e o reflexo no chão, com a mesma geometria) ----------
  const capacidade = planta.predios.length + NOVOS;
  const geoPredio = guardar(new THREE.BoxGeometry(LADO, 1, LADO).translate(0, 0.5, 0));
  const maxMudancas = Math.max(1, ...arquivos.map((a) => a.mudancas));
  const dados = new Float32Array(capacidade * 3), apagado = new Float32Array(capacidade), evento = new Float32Array(capacidade * 3);
  const contaNaQuadra = planta.quadras.map(() => 0);
  planta.predios.forEach((b, i) => {
    const local = contaNaQuadra[b.quadra]!++ / Math.max(1, planta.quadras[b.quadra]!.lista.length);
    dados.set([calorDe(b.p.mudancas, maxMudancas), Math.random(), atrasoQuadra(b.quadra) + local * 0.4 + Math.random() * 0.08], i * 3);
  });
  const attrDados = new THREE.InstancedBufferAttribute(dados, 3);
  const attrApagado = new THREE.InstancedBufferAttribute(apagado, 1);
  const attrEvento = new THREE.InstancedBufferAttribute(evento, 3);
  geoPredio.setAttribute('aDados', attrDados);
  geoPredio.setAttribute('aApagado', attrApagado);
  geoPredio.setAttribute('aEvento', attrEvento);
  const uniformesPredio = () => comNevoa({
    uTempo: tempo, uSubida: subida, uMovimento: movimento, uCorBase: { value: new THREE.Color(COR.corpo) }, uCorAlto: { value: new THREE.Color(COR.corpoAlto) },
    uBorda: { value: hdr(COR.borda, 1.2) }, uQuente: { value: hdr(COR.quente, 2) }, uLaranja: { value: hdr(COR.laranja, 1.8) },
    uJanelaFria: { value: hdr(COR.janelaFria, 1.5) }, uJanelaQuente: { value: hdr(COR.janelaQuente, 1.5) }, uLua: { value: new THREE.Color(COR.lua) },
    uLer: { value: hdr(COR.ler, 1.5) }, uEditar: { value: hdr(COR.editar, 1.5) }, uApagarCor: { value: hdr(COR.apagar, 1.6) },
  });
  const predios = new THREE.InstancedMesh(geoPredio, guardar(new THREE.ShaderMaterial({
    vertexShader: S.predioVertex, fragmentShader: S.predioFragment, fog: true, uniforms: uniformesPredio(),
  })), capacidade);
  planta.predios.forEach((b, i) => { m.makeScale(1, b.h, 1).setPosition(b.x, CHAO, b.z); predios.setMatrixAt(i, m); });
  predios.count = planta.predios.length;
  predios.frustumCulled = false; // prédios novos podem nascer fora da esfera calculada no começo
  cena.add(predios);
  const reflexo = new THREE.InstancedMesh(geoPredio, guardar(new THREE.ShaderMaterial({
    vertexShader: S.predioVertex, fragmentShader: S.predioFragment, fog: true, transparent: true, depthWrite: false,
    defines: { ESPELHO: '' }, uniforms: uniformesPredio(),
  })), capacidade);
  reflexo.instanceMatrix = predios.instanceMatrix;
  reflexo.count = predios.count;
  reflexo.scale.y = -1;
  reflexo.renderOrder = -2;
  reflexo.frustumCulled = false;
  cena.add(reflexo);
  const indice = new Map(planta.predios.map((b, i) => [b.p.caminho, i]));

  // ---------- faróis: os arquivos mais alterados ----------
  // faróis: os 8 arquivos mais alterados (com pelo menos 3 mudanças), não importa o tamanho do projeto
  const caminhosFarol = faroisDe(planta.predios.map((b) => b.p));
  const quentes = planta.predios.map((b, i) => ({ b, i, calor: dados[i * 3]! })).filter((x) => caminhosFarol.has(x.b.p.caminho))
    .sort((a, b) => b.b.p.mudancas - a.b.p.mudancas);
  const apagarFeixes = { value: 0 };
  const geoFeixe = guardar(new THREE.CylinderGeometry(0.85, 0.12, 1, 28, 1, true).translate(0, 0.5, 0));
  const fases = new Float32Array(Math.max(1, quentes.length));
  quentes.forEach((_, k) => { fases[k] = Math.random(); });
  geoFeixe.setAttribute('aFase', new THREE.InstancedBufferAttribute(fases, 1));
  const feixes = new THREE.InstancedMesh(geoFeixe, guardar(new THREE.ShaderMaterial({
    vertexShader: S.feixeVertex, fragmentShader: S.feixeFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTempo: tempo, uSubida: subida, uQuente: { value: hdr(COR.quente, 1.4) }, uLaranja: { value: hdr(COR.laranja, 1.2) }, uApagar: apagarFeixes },
  })), Math.max(1, quentes.length));
  const alturaFeixe = tamanho * 0.55;
  quentes.forEach(({ b }, k) => { m.makeScale(1, alturaFeixe, 1).setPosition(b.x, CHAO + b.h, b.z); feixes.setMatrixAt(k, m); });
  feixes.count = quentes.length;
  feixes.frustumCulled = false;
  cena.add(feixes);

  // ---------- halos (brilho falso, direto na tela) ----------
  // um halo suave no alto de cada prédio: violeta/ciano fraco nos calmos, laranja/vermelho forte nos quentes;
  // os faróis ganham um halo grande. Assim a base brilha sem bloom.
  const nBase = planta.predios.length;
  const posHalo = new Float32Array(Math.max(1, nBase) * 3), corHalo = new Float32Array(Math.max(1, nBase) * 3), dadosHalo = new Float32Array(Math.max(1, nBase) * 3);
  const apagadoHalo = new THREE.BufferAttribute(new Float32Array(Math.max(1, nBase)), 1);
  const frio = new THREE.Color(COR.borda), quenteC = new THREE.Color(COR.quente), laranjaC = new THREE.Color(COR.laranja), tom = new THREE.Color();
  const farois = new Set(quentes.map((x) => x.i));
  planta.predios.forEach((b, i) => {
    const calor = dados[i * 3]!;
    posHalo.set([b.x, CHAO + 0.05, b.z], i * 3);
    tom.copy(frio).multiplyScalar(0.10).lerp(laranjaC.clone().lerp(quenteC, calor).multiplyScalar(0.55), Math.min(1, calor * 1.3));
    if (farois.has(i)) tom.copy(quenteC).lerp(laranjaC, 0.3).multiplyScalar(0.8);
    corHalo.set([tom.r, tom.g, tom.b], i * 3);
    // prédio frio fica sem halo (tamanho 0 = a placa nem desenha): em projeto grande, mil halos quase invisíveis
    // somados custariam caro numa placa integrada
    dadosHalo.set([farois.has(i) ? 6 : calor < 0.25 ? 0 : 1.6 + calor * 2.4, b.h, dados[i * 3 + 2]!], i * 3);
  });
  const geoHalo = guardar(new THREE.BufferGeometry());
  geoHalo.setAttribute('position', new THREE.BufferAttribute(posHalo, 3));
  geoHalo.setAttribute('aCor', new THREE.BufferAttribute(corHalo, 3));
  geoHalo.setAttribute('aHalo', new THREE.BufferAttribute(dadosHalo, 3));
  geoHalo.setAttribute('aApagado', apagadoHalo);
  geoHalo.setDrawRange(0, nBase);
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
    uniforms: comNevoa({ uTempo: tempo, uPixel: pixel, uSubida: subida, uCor: { value: new THREE.Color(COR.trafego) } }),
  })));
  trafego.frustumCulled = false;
  trafego.visible = nTrafego > 0;
  cena.add(trafego);

  // ---------- névoa em camadas ----------
  const camadas = [1.4, 3.8].map((y, k) => {
    const c = new THREE.Mesh(guardar(new THREE.PlaneGeometry(raio * 2.6, raio * 2.6).rotateX(-Math.PI / 2)), guardar(new THREE.ShaderMaterial({
      vertexShader: S.nevoaVertex, fragmentShader: S.nevoaFragment, transparent: true, depthWrite: false,
      uniforms: { uTempo: tempo, uRaio: { value: raio * 1.2 }, uLuz: luz, uCor: { value: new THREE.Color(k ? '#3a2a8a' : '#2a2370') }, uForca: { value: k ? 0.1 : 0.16 } },
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
    ponto: new THREE.Vector3(q.x + q.largura / 2, CHAO + maisAlto[i]! + 0.9, q.z + q.fundo / 2), apagado: false, acende: atrasoQuadra(i) + 1.1, tr: '', vis: false, apg: false }))
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
    const maximo = w < 640 ? 5 : 8; // poucos nomes, os dos maiores bairros: o resto aparece ao aproximar
    for (const r of rotulos) {
      vet.copy(r.ponto).project(camera);
      const x = (vet.x * 0.5 + 0.5) * w, y = (-vet.y * 0.5 + 0.5) * h;
      const ret: [number, number, number, number] = [x - r.w / 2 - 4, y - r.h - 4, x + r.w / 2 + 4, y + 4];
      const dentro = subida.value >= r.acende && vet.z < 1 && ret[0] > 4 && ret[2] < w - 4 && ret[1] > (w < 640 ? 100 : 52) && y < h - 8; // aceso e fora do HUD
      const livre = dentro && ocupados.length < maximo && !ocupados.some((o) => o[0] < ret[2] && ret[0] < o[2] && o[1] < ret[3] && ret[1] < o[3]);
      if (livre) ocupados.push(ret);
      // só mexe no DOM quando muda (escrever estilo de 80 rótulos a cada quadro custava CPU à toa)
      if (livre) { const tr = `translate(${Math.round(x - r.w / 2)}px, ${Math.round(y - r.h)}px)`; if (tr !== r.tr) { r.el.style.transform = tr; r.tr = tr; } }
      if (livre !== r.vis) { r.el.classList.toggle('visivel', livre); r.vis = livre; }
      if (r.apagado !== r.apg) { r.el.classList.toggle('apagado', r.apagado); r.apg = r.apagado; }
    }
  }

  // ---------- câmera e controles ----------
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
    // tela estreita (celular): mais perto, cortando as laterais (a órbita lenta mostra o resto)
    return (raioCidade / Math.sin(Math.min(meiaVista, meiaLargura))) * (camera.aspect < 0.9 ? 0.46 : 0.6);
  };
  const final = { pos: new THREE.Vector3(), alvo: new THREE.Vector3(0, alturaMax * 0.12, 0) };
  // câmera baixa (uns 25 graus), como quem olha a cidade de um prédio vizinho
  const calcularFinal = () => { const d = distanciaIdeal(); final.pos.set(d * 0.62, d * 0.34, d * 0.72); };

  // ---------- diagnóstico (sem dados pessoais: placa de vídeo, recursos do WebGL, extras, checagens e erros) ----------
  const gl = renderer.getContext();
  const infoPlaca = gl.getExtension('WEBGL_debug_renderer_info');
  const placa = String(infoPlaca ? gl.getParameter(infoPlaca.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 120);
  // O bloom desenha antes numa imagem fora da tela, em ponto flutuante. Placas que não aceitam esse formato (ou o
  // antisserrilhado nele) devolvem um quadro vazio. Por isso ele é só um extra, ligado depois de passar na checagem.
  // placa integrada (divide a memória com o processador): menos pixels e animação de fundo a 30 quadros por segundo
  const integrada = /Intel|UHD|Iris|HD Graphics|Radeon\(TM\) (Graphics|Vega)|AMD Radeon Graphics|Mali|Adreno|PowerVR|Apple|SwiftShader|llvmpipe|Basic Render/i.test(placa);
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

  let composer: EffectComposer | null = null; // só existe se os extras ligarem
  let bloom: UnrealBloomPass | null = null;
  function criarBloom() {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: amostras }));
    composer.addPass(new RenderPass(cena, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---------- adaptação: um visual só, o melhor que a máquina aguenta ----------
  // alivio 0 = base completa; 1 = menos nitidez e metade do tráfego; 2 = também sem névoa em camadas, reflexo e
  // estrelas (é o modo seguro, usado também se a checagem da base falhar). Extras = bloom de verdade e mais nitidez.
  const estado = { alivio: 0, extras: false, extrasMotivo: 'ainda não testados', fps: 0 };
  const placasSemExtras = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_EXTRAS) ?? '[]') as string[]; } catch { return []; } })();
  const podeExtras = () => bufferFloat && !celular && !integrada && !placasSemExtras.includes(placa);
  function aplicar() {
    // placa integrada (referência: Intel UHD 620) e celular: densidade 1 (com 1,5 eram 2,25 vezes mais pixels por quadro)
    const teto = estado.extras ? 1.75 : estado.alivio === 0 && !integrada && !celular ? 1.5 : 1;
    const dpr = Math.min(devicePixelRatio, teto);
    renderer.setPixelRatio(dpr);
    composer?.setPixelRatio(dpr);
    pixel.value = dpr;
    if (bloom) bloom.enabled = estado.extras;
    geoTrafego.setDrawRange(0, estado.alivio >= 1 ? Math.floor(nTrafego / 2) : nTrafego);
    for (const camada of camadas) camada.visible = estado.alivio < 2;
    reflexo.visible = estado.alivio < 2;
    estrelas.visible = estado.alivio < 2;
    ajustar();
  }
  function ligarExtras() {
    if (!composer) criarBloom();
    estado.extras = true; estado.extrasMotivo = 'em teste';
    aplicar();
    agendarVerificacao('extras');
  }
  function desligarExtras(motivo: string, lembrar: boolean) {
    estado.extras = false; estado.extrasMotivo = motivo;
    if (lembrar) { try { localStorage.setItem(CHAVE_EXTRAS, JSON.stringify([...placasSemExtras, placa].slice(-8))); } catch { /* sem storage */ } }
    aplicar();
  }

  // ---------- checagem de segurança: o quadro saiu com prédios? ----------
  // 1) desenha o mesmo quadro com e sem os prédios e compara pixels onde eles deveriam estar;
  // 2) pinta os prédios de magenta puro por um instante e confere que a cor chega à tela.
  // Assim pega tanto prédios que não são desenhados quanto prédios que existem mas não aparecem.
  const verificacao = { em: -1, tentativas: 0, alvo: 'base' as 'base' | 'extras', forcou: false };
  // só para os testes automáticos: finge que os extras não mostram os prédios, ou força tentar os extras
  const simularFalha = teste('gyde-teste-cidade-falha') === 'extras';
  const forcarExtras = teste('gyde-teste-cidade-extras') === '1';
  function agendarVerificacao(alvo: 'base' | 'extras') { verificacao.alvo = alvo; verificacao.em = menosMovimento ? 0 : relogio() + 0.6; verificacao.tentativas = 0; desenhar(); }
  const pontosConferir = [...planta.predios].sort((a, b) => b.h - a.h).slice(0, 80).map((b) => new THREE.Vector3(b.x, CHAO + b.h * 0.5, b.z));
  function renderizar() {
    const esconder = simularFalha && estado.extras && predios.visible;
    const reflexoAntes = reflexo.visible;
    if (esconder) { predios.visible = false; reflexo.visible = false; }
    if (estado.extras && composer && bloom) {
      // de perto, as janelas ocupam a tela e o bloom vira um véu: ele enfraquece com a aproximação
      bloom.strength = 0.75 * THREE.MathUtils.clamp(camera.position.distanceTo(controles.target) / (distanciaIdeal() * 0.75), 0.25, 1);
      composer.render();
    } else renderer.render(cena, camera);
    if (esconder) { predios.visible = true; reflexo.visible = reflexoAntes; }
  }
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
    const magentaPx = amostrar(pts);
    predios.material = materialReal; reflexo.visible = refl; halos.visible = hal;
    renderizar(); // a tela fica com o quadro normal
    let diferenca = 0, maximo = 0, magenta = 0;
    com.forEach((c, i) => {
      const o = sem[i]!, t = magentaPx[i]!;
      diferenca += Math.abs(c[0]! - o[0]!) + Math.abs(c[1]! - o[1]!) + Math.abs(c[2]! - o[2]!);
      maximo = Math.max(maximo, ...c);
      if (t[0]! > 120 && t[2]! > 120 && t[1]! < Math.min(t[0]!, t[2]!) * 0.6) magenta++;
    });
    diferenca /= pts.length * 3;
    const fracaoMagenta = magenta / pts.length;
    const motivo = fracaoMagenta < 0.5 ? 'a geometria dos prédios não chega à tela' : maximo <= 2 ? 'quadro preto' : diferenca <= 1.5 ? 'o shader dos prédios sai igual ao fundo' : '';
    return { ok: !motivo, motivo, diferenca: Math.round(diferenca * 10) / 10, magenta: Math.round(fracaoMagenta * 100), pontos: pts.length };
  }
  function tratarVerificacao(r: NonNullable<ReturnType<typeof verificarQuadro>>) {
    const alvo = verificacao.alvo;
    historico.push(`${alvo === 'extras' ? 'extras (bloom)' : estado.alivio >= 2 ? 'base segura' : 'base'}: ${r.ok ? 'prédios aparecendo' : `falhou (${r.motivo})`}; diferença ${r.diferenca}; magenta ${r.magenta}% de ${r.pontos} pontos`);
    const diag = { placa, alvo, alivio: estado.alivio, bufferFloat, amostras, diferenca: r.diferenca, magenta: `${r.magenta}%`, motivo: r.motivo || 'nenhum', errosShader: errosGl.length };
    if (r.ok) {
      caixa.dataset.verificacao = 'ok';
      if (alvo === 'extras') { estado.extrasMotivo = 'ligados (passaram na checagem)'; caixa.dataset.extras = 'ligados'; }
      console.info('[Gyde · Cidade 3D] quadro conferido: prédios aparecendo', diag);
      if (alvo === 'base' && forcarExtras && bufferFloat && !estado.extras && !verificacao.forcou) { verificacao.forcou = true; ligarExtras(); } // teste: força uma vez, mesmo em placa integrada
      return;
    }
    console.warn('[Gyde · Cidade 3D] os prédios não apareceram neste quadro', diag, errosGl.slice(0, 3));
    if (alvo === 'extras') { // os extras não servem nesta placa: volta para a base em silêncio e não tenta de novo nela
      desligarExtras(`desligados: falharam na checagem (${r.motivo})`, true);
      caixa.dataset.extras = 'falharam';
      agendarVerificacao('base');
    } else if (estado.alivio < 2) {
      estado.alivio = 2;
      if (estado.extras) desligarExtras('desligados: a base falhou', false); else aplicar();
      caixa.dataset.verificacao = 'recuou-segura';
      agendarVerificacao('base');
    } else {
      caixa.dataset.verificacao = 'falhou';
      aoAviso?.('Esta placa de vídeo não conseguiu mostrar os prédios em 3D. Use a Lista para ver os mesmos dados.', true);
    }
  }

  // ---------- a Forja mexeu num arquivo ----------
  const TIPO = { ler: 1, editar: 2, criar: 3, apagar: 4 } as const;
  let acompanhar: { alvo: THREE.Vector3; ate: number } | null = null;
  function marcar(i: number, tipo: number) {
    evento.set([tipo, tempo.value, 0], i * 3);
    attrEvento.needsUpdate = true;
    if (menosMovimento) { // sem animação: fica aceso alguns segundos e apaga
      setTimeout(() => { if (evento[i * 3] === tipo) { evento[i * 3] = 0; attrEvento.needsUpdate = true; desenhar(); } }, 5000);
    }
  }
  function criarPredio(caminho: string): number {
    const iq = planta.quadras.findIndex((q) => q.nome === bairroDe(caminho));
    if (iq < 0 || predios.count >= capacidade) return -1; // pasta nova: aparece ao clicar em Atualizar
    const q = planta.quadras[iq]!;
    const vaga = contaNaQuadra[iq]!++;
    const pos = posicaoNaQuadra(q, vaga);
    const p: TPredio = { caminho, linhas: 20, bytes: 600, binario: false, mudancas: 1, ultima: Date.now() };
    const b = { p, h: alturaDe(p), quadra: iq, ...pos };
    const i = predios.count;
    planta.predios.push(b);
    indice.set(caminho, i);
    m.makeScale(1, b.h, 1).setPosition(b.x, CHAO, b.z);
    predios.setMatrixAt(i, m);
    predios.instanceMatrix.needsUpdate = true;
    dados.set([0.2, Math.random(), 0], i * 3);
    attrDados.needsUpdate = true;
    predios.count = reflexo.count = i + 1;
    return i;
  }

  // ---------- laço de desenho ----------
  const inicioRelogio = performance.now();
  // segundos desde que a cena abriu (os testes de captura podem desacelerar, para fotografar a abertura em quadros lentos)
  const escalaTempo = Number(teste('gyde-teste-cidade-lento')) || 1;
  const relogio = () => ((performance.now() - inicioRelogio) / 1000) * escalaTempo;
  let quadro = 0, visivelNaTela = true, ultimoMexer = -1e9, interagindo = false, quadrosDesenhados = 0;
  // a abertura só começa depois do primeiro quadro na tela (compilar os shaders demora, e comeria o começo)
  const entrada = { ativa: !menosMovimento, inicio: 0, pronta: menosMovimento };
  let voo: { de: THREE.Vector3; para: THREE.Vector3; alvoDe: THREE.Vector3; alvoPara: THREE.Vector3; inicio: number } | null = null;
  const medidor = { quadros: 0, inicio: 0, testouExtras: false };
  const esfera = new THREE.Spherical(), esferaFinal = new THREE.Spherical(), esferaInicio = new THREE.Spherical();
  // Ritmo: a animação de fundo (órbita lenta, pulsos, tráfego) roda a 30 quadros por segundo em placa integrada e a 60
  // nas outras; mexer na cena, a abertura e os voos de câmera vão na velocidade da tela. Em segundo plano (Ao vivo
  // aberto ao lado, janela sem foco) a cidade só desenha quando algo muda, ou por alguns segundos depois de a Forja agir.
  const fpsFundo = integrada ? 30 : 60;
  let pausada = false, semFoco = !document.hasFocus(), animarAte = 0, ultimoQuadro = 0;
  const intervalos: number[] = [], custos: number[] = []; // tempos de quadro (diagnóstico)
  const aoFoco = () => { semFoco = false; desenhar(); };
  const aoDesfoco = () => { semFoco = true; };
  window.addEventListener('focus', aoFoco);
  window.addEventListener('blur', aoDesfoco);
  function desenhar() { if (!quadro && visivelNaTela && !document.hidden) quadro = requestAnimationFrame(passo); }
  function passo() {
    quadro = 0;
    const agora = relogio();
    const movimento = interagindo || entrada.ativa || Boolean(voo) || Boolean(acompanhar) || !entrada.pronta || verificacao.em >= 0;
    const fundoParado = (pausada || semFoco) && agora > animarAte;
    // só fundo: respeita o ritmo (pula o quadro sem desenhar se ainda é cedo)
    if (!movimento && !fundoParado && !menosMovimento && ultimoQuadro && performance.now() - ultimoQuadro < 1000 / fpsFundo - 2) { desenhar(); return; }
    let continuar = !menosMovimento && !fundoParado; // pulsos, tráfego e órbita lenta pedem desenho contínuo
    if (!entrada.pronta && enquadrada) { entrada.pronta = quadrosDesenhados > 0; entrada.inicio = agora; }
    if (!menosMovimento) {
      tempo.value = agora;
      subida.value = agora - entrada.inicio;
      luz.value = THREE.MathUtils.smoothstep(subida.value, 0.1, 1.8);
    }
    if (entrada.ativa) {
      // a câmera desce do alto (quase olhando para baixo) numa curva até a vista final
      const t = Math.min(1, (agora - entrada.inicio) / ABERTURA), s = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      esfera.radius = THREE.MathUtils.lerp(esferaInicio.radius, esferaFinal.radius, s);
      esfera.phi = THREE.MathUtils.lerp(esferaInicio.phi, esferaFinal.phi, s);
      esfera.theta = THREE.MathUtils.lerp(esferaInicio.theta, esferaFinal.theta, s);
      camera.position.setFromSpherical(esfera).add(final.alvo);
      controles.target.copy(final.alvo);
      if (t >= 1) entrada.ativa = false;
    }
    if (voo) {
      const t = Math.min(1, (performance.now() - voo.inicio) / 1100), s = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      camera.position.lerpVectors(voo.de, voo.para, s); controles.target.lerpVectors(voo.alvoDe, voo.alvoPara, s);
      if (t < 1) continuar = true; else voo = null;
    }
    // a câmera acompanha de leve o prédio em que a Forja mexeu (sem tirar o controle de quem está mexendo)
    if (acompanhar && !interagindo && !voo && !entrada.ativa) {
      const antes = controles.target.clone();
      controles.target.lerp(acompanhar.alvo, 0.03);
      camera.position.add(controles.target.clone().sub(antes));
      if (agora > acompanhar.ate) acompanhar = null;
    }
    // órbita lenta quando ninguém mexe há alguns segundos (pausa ao interagir)
    controles.autoRotate = !menosMovimento && !interagindo && !entrada.ativa && !voo && !fundoParado && agora - ultimoMexer > 6;
    if (controles.update()) continuar = true;
    const t0 = performance.now();
    renderizar();
    const t1 = performance.now();
    if (ultimoQuadro) { intervalos.push(t1 - ultimoQuadro); custos.push(t1 - t0); if (intervalos.length > 240) { intervalos.shift(); custos.shift(); } }
    ultimoQuadro = t1;
    quadrosDesenhados++;
    posicionarRotulos();
    // confere depois que a abertura terminou (prédios de pé) e a câmera parou de voar
    if (verificacao.em >= 0 && agora >= verificacao.em && !entrada.ativa && !voo && subida.value >= 4.5) {
      verificacao.em = -1;
      const r = verificarQuadro();
      if (r) tratarVerificacao(r);
      else if (++verificacao.tentativas < 6) { verificacao.em = agora + 2; continuar = true; }
      else { caixa.dataset.verificacao = 'sem-conferir'; historico.push('não deu para conferir (poucos prédios à vista)'); }
    } else if (verificacao.em >= 0) continuar = true;
    // mede o FPS depois da abertura: alivia se sofrer; liga extras se sobrar (só uma tentativa por abertura)
    if (!menosMovimento && !entrada.ativa && !fundoParado && caixa.dataset.verificacao === 'ok' && verificacao.em < 0) {
      medidor.quadros++;
      if (medidor.quadros === 1) medidor.inicio = agora;
      else if (agora - medidor.inicio > 3) {
        const fps = (medidor.quadros - 1) / (agora - medidor.inicio);
        estado.fps = Math.round(fps);
        medidor.quadros = 0;
        if (estado.extras && fps < 45) desligarExtras(`desligados: o FPS caiu para ${Math.round(fps)}`, false);
        else if (!estado.extras && fps < Math.min(28, fpsFundo * 0.8) && estado.alivio < 2) { estado.alivio++; aplicar(); }
        else if (!estado.extras && !medidor.testouExtras && estado.alivio === 0 && fps >= 55 && podeExtras()) { medidor.testouExtras = true; ligarExtras(); }
        else if (!estado.extras && !podeExtras() && estado.extrasMotivo === 'ainda não testados') estado.extrasMotivo = !bufferFloat ? 'desligados: a placa não aceita imagem em ponto flutuante' : celular ? 'desligados: celular' : 'desligados: já falharam nesta placa';
      }
    }
    if (continuar) desenhar(); else ultimoQuadro = 0; // parou: o próximo intervalo não conta a pausa
  }
  controles.addEventListener('change', desenhar);
  controles.addEventListener('start', () => { interagindo = true; entrada.ativa = false; voo = null; });
  controles.addEventListener('end', () => { interagindo = false; ultimoMexer = relogio(); desenhar(); });

  function ajustar() {
    const { width, height } = caixa.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    alturaTela.value = height * renderer.getPixelRatio();
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
      esferaFinal.setFromVector3(final.pos.clone().sub(final.alvo));
      esferaInicio.set(esferaFinal.radius * 1.55, 0.06, esferaFinal.theta - 1.15); // do alto, quase de cima, girado
      camera.position.copy(menosMovimento ? final.pos : new THREE.Vector3().setFromSpherical(esferaInicio).add(final.alvo));
      controles.target.copy(final.alvo); controles.update();
      entrada.inicio = relogio();
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
  // só para os testes automáticos: onde um prédio aparece na tela (o teste clica ali, com o clique de verdade)
  if (teste('gyde-teste-cidade-ponto') === '1') {
    (caixa as HTMLElement & { __pontoDe?: (c: string) => { x: number; y: number } | null }).__pontoDe = (caminho) => {
      const i = indice.get(caminho); if (i == null) return null;
      const b = planta.predios[i]!, r = renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector3(b.x, CHAO + b.h * 0.6, b.z).project(camera);
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    };
  }

  const api: Cidade3D = {
    destruir() {
      cancelAnimationFrame(quadro);
      observador.disconnect(); naTela.disconnect(); document.removeEventListener('visibilitychange', aoMudarAba);
      window.removeEventListener('focus', aoFoco); window.removeEventListener('blur', aoDesfoco);
      renderer.domElement.removeEventListener('webglcontextlost', aoPerderContexto);
      controles.dispose();
      for (const d of descartar) d.dispose();
      lajes.dispose(); predios.dispose(); reflexo.dispose(); feixes.dispose();
      composer?.dispose(); bloom?.dispose();
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
      ultimoMexer = relogio();
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
      (apagadoHalo.array as Float32Array).set(apagado.subarray(0, nBase));
      apagadoHalo.needsUpdate = true;
      apagarFaixas.value = t ? 1 : 0;
      apagarFeixes.value = t ? 1 : 0;
      for (const r of rotulos) r.apagado = Boolean(t) && !bairrosVivos.has(r.i);
      desenhar();
      return combinam;
    },
    reagir({ tipo, caminho }) {
      const c = normalizarCaminho(caminho);
      let i = indice.get(c) ?? -1;
      if (i < 0 && (tipo === 'criar' || tipo === 'editar')) i = criarPredio(c);
      if (i < 0) return false;
      marcar(i, TIPO[tipo === 'editar' && evento[i * 3] === TIPO.criar ? 'criar' : tipo]);
      if (tipo === 'apagar') { indice.delete(c); if (selecionado === i) api.selecionar(null); }
      const b = planta.predios[i]!;
      if (!menosMovimento) acompanhar = { alvo: new THREE.Vector3(b.x, CHAO + b.h * 0.4, b.z), ate: relogio() + 2.5 };
      animarAte = relogio() + 5; // o pulso aparece mesmo com a cidade em segundo plano
      desenhar();
      return true;
    },
    pausar(sim) { pausada = sim; desenhar(); },
    diagnostico() {
      const tela = renderer.getDrawingBufferSize(new THREE.Vector2());
      const ord = (v: number[]) => [...v].sort((a, b) => a - b);
      const pct = (v: number[], k: number) => (v.length ? ord(v)[Math.min(v.length - 1, Math.floor(v.length * k))]!.toFixed(1) : '-');
      return [
        'Gyde · Cidade 3D · diagnóstico',
        `Placa de vídeo: ${placa}`,
        `WebGL: ${renderer.capabilities.isWebGL2 ? '2' : '1'} · imagem em ponto flutuante: ${bufferFloat ? 'aceita' : 'não aceita'} · antisserrilhado fora da tela: ${amostras} amostras (máx. ${renderer.capabilities.maxSamples}) · textura máx.: ${renderer.capabilities.maxTextureSize}`,
        `Desenho: ${estado.extras ? 'com extras (bloom, imagem fora da tela)' : 'direto na tela'} · alívio: ${['nenhum', 'menos nitidez', 'modo seguro'][estado.alivio]} · extras: ${estado.extrasMotivo} · FPS medido: ${estado.fps || 'ainda não'}`,
        `Tela: ${tela.x}×${tela.y} px · densidade ${renderer.getPixelRatio()} · placa integrada: ${integrada ? 'sim' : 'não'} · celular: ${celular ? 'sim' : 'não'} · menos movimento: ${menosMovimento ? 'sim' : 'não'}`,
        `Quadros: ritmo de fundo ${fpsFundo} por segundo${pausada || semFoco ? ' (pausado: em segundo plano)' : ''} · intervalo entre quadros mediana ${pct(intervalos, 0.5)} ms, pior 5% ${pct(intervalos, 0.95)} ms · tempo de CPU para desenhar mediana ${pct(custos, 0.5)} ms, pior 5% ${pct(custos, 0.95)} ms (últimos ${intervalos.length} quadros)`,
        `Prédios: ${predios.count} · bairros: ${nq} · faróis: ${quentes.length}`,
        `Checagens: ${historico.length ? historico.join(' | ') : 'ainda não feita'}`,
        `Erros: ${errosGl.length ? errosGl.slice(0, 5).join(' | ') : 'nenhum'}`,
      ].join('\n');
    },
  };

  console.info('[Gyde · Cidade 3D] início', { placa, bufferFloat, amostras, celular, menosMovimento, predios: planta.predios.length });
  caixa.dataset.extras = 'desligados';
  aplicar();
  agendarVerificacao('base');
  if (menosMovimento) tempo.value = 1.7;
  desenhar();
  return api;
}
