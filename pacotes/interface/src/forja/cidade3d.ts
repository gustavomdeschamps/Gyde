// Cidade do código em 3D (Three.js). Este arquivo só é baixado quando a aba Cidade abre (import dinâmico em Cidade.svelte),
// então quem nunca abre a aba não carrega o Three.js. Pasta = bairro (uma quadra no chão), arquivo = prédio,
// altura = tamanho, cor = quantas vezes mudou no git (cinza = nunca, vermelho = o mais alterado).
// Desenha só quando algo muda (girar, aproximar, passar o mouse): parada, a cena não gasta processador.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TPredio } from '$contratos';
import { calorDe, bairroDe, CORES_CALOR } from './cidade-comum.ts';

export interface Cidade3D {
  destruir(): void;
  selecionar(caminho: string | null): void; // destaca um prédio (ou nenhum)
  focar(caminho: string): void; // leva a câmera até o prédio
}
interface Opcoes {
  aoEscolher: (p: TPredio | null) => void; // clique (ou toque) num prédio, ou no vazio
  aoPassar: (p: TPredio | null, x: number, y: number) => void; // mouse em cima de um prédio
}

const CELULA = 1.6; // espaço de cada prédio na quadra
const LADO = 1; // largura do prédio
const MARGEM = 0.9; // borda da quadra em volta dos prédios
const RUA = 1.4; // espaço entre quadras
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
  const predios: { p: TPredio; x: number; z: number; h: number }[] = [];
  for (const q of quadras) {
    q.x -= larguraTotal / 2; q.z -= fundoTotal / 2; // cidade centrada na origem
    q.lista.forEach((p, i) => predios.push({ p, h: alturaDe(p),
      x: q.x + MARGEM + (i % q.colunas) * CELULA + LADO / 2, z: q.z + MARGEM + Math.floor(i / q.colunas) * CELULA + LADO / 2 }));
  }
  return { quadras, predios, largura: larguraTotal, fundo: fundoTotal };
}

const escuro = () => (document.documentElement.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';

export function criarCidade3D(caixa: HTMLElement, arquivos: TPredio[], { aoEscolher, aoPassar }: Opcoes): Cidade3D {
  const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // sem WebGL, isto lança erro e a tela mostra a lista
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = 'cidade-canvas';
  caixa.append(renderer.domElement);

  const cena = new THREE.Scene();
  const planta = montarPlanta(arquivos);
  const tamanho = Math.max(planta.largura, planta.fundo, 12);

  cena.add(new THREE.HemisphereLight(0xffffff, 0x8090a0, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(tamanho * 0.4, tamanho, tamanho * 0.7);
  cena.add(sol);

  // chão de cada bairro
  const chaoGeo = new THREE.BoxGeometry(1, 0.12, 1);
  const chaoMat = new THREE.MeshLambertMaterial();
  const chao = new THREE.InstancedMesh(chaoGeo, chaoMat, Math.max(1, planta.quadras.length));
  const m = new THREE.Matrix4();
  planta.quadras.forEach((q, i) => { m.makeScale(q.largura, 1, q.fundo).setPosition(q.x + q.largura / 2, -0.06, q.z + q.fundo / 2); chao.setMatrixAt(i, m); });
  chao.count = planta.quadras.length;
  cena.add(chao);

  // prédios: uma malha só, repetida (aguenta milhares de prédios)
  const predioGeo = new THREE.BoxGeometry(LADO, 1, LADO).translate(0, 0.5, 0);
  const predioMat = new THREE.MeshLambertMaterial();
  const predios = new THREE.InstancedMesh(predioGeo, predioMat, Math.max(1, planta.predios.length));
  planta.predios.forEach((b, i) => { m.makeScale(1, b.h, 1).setPosition(b.x, 0, b.z); predios.setMatrixAt(i, m); });
  predios.count = planta.predios.length;
  cena.add(predios);
  const indice = new Map(planta.predios.map((b, i) => [b.p.caminho, i]));
  const maxMudancas = Math.max(1, ...arquivos.map((a) => a.mudancas));

  let selecionado = -1, sobMouse = -1;
  const cor = new THREE.Color();
  function pintar() {
    const e = escuro();
    chaoMat.color.set(e ? '#1c2540' : '#dfe5f0');
    // mistura feita em sRGB, igual ao quadradinho da lista (color-mix), para as duas formas mostrarem a mesma cor
    const frio = new THREE.Color(e ? CORES_CALOR.frioEscuro : CORES_CALOR.frio).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    const quente = new THREE.Color(CORES_CALOR.quente).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    planta.predios.forEach((b, i) => {
      if (i === selecionado) cor.set(e ? '#7aa2ff' : '#2563eb');
      else { const t = calorDe(b.p.mudancas, maxMudancas); cor.setRGB(frio.r + (quente.r - frio.r) * t, frio.g + (quente.g - frio.g) * t, frio.b + (quente.b - frio.b) * t, THREE.SRGBColorSpace); }
      if (i === sobMouse && i !== selecionado) cor.offsetHSL(0, 0, e ? 0.12 : -0.1);
      predios.setColorAt(i, cor);
    });
    if (predios.instanceColor) predios.instanceColor.needsUpdate = true;
    desenhar();
  }

  // câmera enquadrando a cidade inteira (raio da caixa que contém quadras e prédios)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, tamanho * 20);
  const alturaMax = Math.max(1, ...planta.predios.map((b) => b.h));
  const raioCidade = Math.hypot(planta.largura / 2, planta.fundo / 2, alturaMax / 2);
  const enquadrar = () => {
    const meiaVista = THREE.MathUtils.degToRad(camera.fov / 2);
    const meiaLargura = Math.atan(Math.tan(meiaVista) * camera.aspect);
    return (raioCidade / Math.sin(Math.min(meiaVista, meiaLargura))) * 0.72; // a esfera em volta sobra nos cantos: 0,72 deixa a cidade ocupando a tela
  };
  const posicionar = () => { const d = enquadrar(); camera.position.set(d * 0.5, d * 0.62, d * 0.6); controles.target.set(0, alturaMax * 0.15, 0); controles.update(); };
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = !menosMovimento;
  controles.dampingFactor = 0.12;
  controles.minDistance = 4;
  controles.maxDistance = tamanho * 4;
  controles.maxPolarAngle = Math.PI * 0.47; // não deixa a câmera passar para baixo do chão
  controles.screenSpacePanning = false;
  let enquadrada = false;

  // desenha só quando precisa; com "menos movimento" não há inércia nem voo de câmera
  let quadro = 0;
  let voo: { de: THREE.Vector3; para: THREE.Vector3; alvoDe: THREE.Vector3; alvoPara: THREE.Vector3; inicio: number } | null = null;
  function desenhar() { if (!quadro) quadro = requestAnimationFrame(passo); }
  function passo(agora: number) {
    quadro = 0;
    let continuar = false;
    if (voo) {
      const t = Math.min(1, (agora - voo.inicio) / 600), s = 1 - (1 - t) ** 3;
      camera.position.lerpVectors(voo.de, voo.para, s); controles.target.lerpVectors(voo.alvoDe, voo.alvoPara, s);
      if (t < 1) continuar = true; else voo = null;
    }
    if (controles.update()) continuar = true;
    renderer.render(cena, camera);
    if (continuar) desenhar();
  }
  controles.addEventListener('change', desenhar);

  function ajustar() {
    const { width, height } = caixa.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!enquadrada) { posicionar(); enquadrada = true; } // só na primeira vez: depois, quem manda na câmera é a pessoa
    desenhar();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(caixa);

  // clique e mouse: o raio sai da tela e acha o prédio
  const raio = new THREE.Raycaster();
  const ponto = new THREE.Vector2();
  function predioEm(ev: PointerEvent): number {
    const r = renderer.domElement.getBoundingClientRect();
    ponto.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponto, camera);
    return raio.intersectObject(predios, false)[0]?.instanceId ?? -1;
  }
  let apertou: { x: number; y: number } | null = null;
  const aoApertar = (ev: PointerEvent) => { apertou = { x: ev.clientX, y: ev.clientY }; };
  const aoSoltar = (ev: PointerEvent) => {
    if (!apertou || Math.hypot(ev.clientX - apertou.x, ev.clientY - apertou.y) > 6) { apertou = null; return; } // foi arrasto, não clique
    apertou = null;
    const i = predioEm(ev);
    selecionado = i; pintar();
    aoEscolher(i >= 0 ? planta.predios[i]!.p : null);
  };
  const aoMover = (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    const i = predioEm(ev);
    if (i !== sobMouse) { sobMouse = i; pintar(); }
    renderer.domElement.style.cursor = i >= 0 ? 'pointer' : '';
    aoPassar(i >= 0 ? planta.predios[i]!.p : null, ev.clientX, ev.clientY);
  };
  const aoSair = () => { if (sobMouse >= 0) { sobMouse = -1; pintar(); } aoPassar(null, 0, 0); };
  renderer.domElement.addEventListener('pointerdown', aoApertar);
  renderer.domElement.addEventListener('pointerup', aoSoltar);
  renderer.domElement.addEventListener('pointermove', aoMover);
  renderer.domElement.addEventListener('pointerleave', aoSair);

  // tema claro/escuro trocado com a aba aberta
  const temaObs = new MutationObserver(pintar);
  temaObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const temaSistema = matchMedia('(prefers-color-scheme: dark)');
  temaSistema.addEventListener('change', pintar);

  ajustar();
  pintar();

  return {
    destruir() {
      cancelAnimationFrame(quadro);
      observador.disconnect(); temaObs.disconnect(); temaSistema.removeEventListener('change', pintar);
      controles.dispose();
      chaoGeo.dispose(); chaoMat.dispose(); predioGeo.dispose(); predioMat.dispose(); chao.dispose(); predios.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
    selecionar(caminho) { selecionado = caminho == null ? -1 : (indice.get(caminho) ?? -1); pintar(); },
    focar(caminho) {
      const i = indice.get(caminho);
      if (i == null) return;
      const b = planta.predios[i]!;
      const alvoPara = new THREE.Vector3(b.x, b.h / 2, b.z);
      const distancia = Math.max(8, b.h * 2.2);
      const direcao = camera.position.clone().sub(controles.target).normalize();
      const para = alvoPara.clone().add(direcao.multiplyScalar(distancia));
      if (menosMovimento) { camera.position.copy(para); controles.target.copy(alvoPara); controles.update(); desenhar(); return; }
      voo = { de: camera.position.clone(), para, alvoDe: controles.target.clone(), alvoPara, inicio: performance.now() };
      desenhar();
    },
  };
}
