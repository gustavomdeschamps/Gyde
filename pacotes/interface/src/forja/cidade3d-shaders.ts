// Shaders da Cidade 3D. Cores "acima de 1" (janelas, neon, faróis) são as que o bloom faz brilhar;
// o corpo dos prédios fica escuro de propósito, para a luz contar a história.

// ---------- prédios (e o reflexo deles no chão, com ESPELHO definido) ----------
export const predioVertex = /* glsl */ `
attribute vec3 aDados;   // x = calor (0..1), y = semente, z = atraso da subida
attribute float aApagado; // 1 = fora da busca (escurece)
uniform float uSubida;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vMundo;
varying float vAltura;
varying float vCalor;
varying float vSemente;
varying float vApagado;
#include <fog_pars_vertex>
void main() {
  float h = length(instanceMatrix[1].xyz);
  float sobe = smoothstep(aDados.z, aDados.z + 0.75, uSubida);
  sobe = sobe * sobe * (3.0 - 2.0 * sobe);
  vec3 p = position;
  p.y *= max(sobe, 0.002);
  vec4 mundo = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vLocal = position;
  vAltura = h * max(sobe, 0.002);
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vMundo = mundo.xyz;
  vCalor = aDados.x;
  vSemente = aDados.y;
  vApagado = aApagado;
  vec4 mvPosition = viewMatrix * mundo;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

export const predioFragment = /* glsl */ `
uniform float uTempo;
uniform vec3 uCorBase;
uniform vec3 uCorAlto;
uniform vec3 uBorda;
uniform vec3 uQuente;
uniform vec3 uLaranja;
uniform vec3 uJanelaFria;
uniform vec3 uJanelaQuente;
uniform vec3 uLua;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vMundo;
varying float vAltura;
varying float vCalor;
varying float vSemente;
varying float vApagado;
#include <fog_pars_fragment>
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 n = normalize(vNormal);
  float y = vLocal.y * vAltura;              // altura real deste ponto
  bool teto = abs(n.y) > 0.5;
  float lado = abs(n.x) > abs(n.z) ? vLocal.z : vLocal.x; // -0.5..0.5 na face
  float face = abs(n.x) > abs(n.z) ? sign(n.x) : 2.0 * sign(n.z);

  // corpo: azul-marinho escuro que clareia para violeta no alto; base mais escura (sombra de contato falsa)
  vec3 cor = mix(uCorBase, uCorAlto, clamp(y / 9.0, 0.0, 1.0));
  cor *= mix(0.35, 1.0, smoothstep(0.0, 1.1, y));
  // luz da lua (fria, de cima e de lado) e contorno violeta (fresnel)
  vec3 lua = normalize(vec3(-0.4, 0.8, 0.35));
  cor += uLua * max(dot(n, lua), 0.0) * 0.1;
  vec3 olho = normalize(cameraPosition - vMundo);
  float fresnel = pow(1.0 - max(dot(n, olho), 0.0), 3.0);
  cor += uBorda * fresnel * 0.24;

  vec3 brilho = vec3(0.0);
  // arquivos quentes: a fachada inteira esquenta (brasa) e pulsa de leve
  float quenteFachada = smoothstep(0.3, 1.0, vCalor);
  cor += mix(uLaranja, uQuente, quenteFachada) * quenteFachada * (0.1 + 0.05 * sin(uTempo * 2.6 + vSemente * 6.283)) * smoothstep(0.0, 2.0, y);
  if (!teto) {
    // janelas: 2 colunas por face, uma fileira a cada 0,42 de altura; algumas acesas, poucas piscam devagar
    float col = floor((lado + 0.5) * 2.0);
    float fx = fract((lado + 0.5) * 2.0);
    float lin = floor(y / 0.42);
    float fy = fract(y / 0.42);
    float janela = step(0.2, fx) * step(fx, 0.8) * step(0.3, fy) * step(fy, 0.76);
    janela *= step(0.3, y) * step(y, vAltura - 0.16);
    float sorte = hash(vec3(col + face * 7.0, lin, vSemente * 91.0));
    float troca = hash(vec3(col, lin, floor(uTempo * 0.12 + vSemente * 13.0)));
    float acesa = step(sorte, 0.2 + vCalor * 0.35) * (troca > 0.04 ? 1.0 : 0.0);
    vec3 tom = mix(uJanelaFria, uJanelaQuente, step(0.62, hash(vec3(col, lin * 3.1, vSemente))));
    tom = mix(tom, uLaranja, smoothstep(0.45, 0.9, vCalor));
    brilho += janela * acesa * tom * (0.75 + 0.9 * hash(vec3(lin, col, vSemente * 3.0)));
    // quinas em neon: frias nos arquivos calmos, quentes nos muito alterados
    float quina = smoothstep(0.455, 0.5, abs(lado));
    vec3 neon = mix(uBorda, uQuente, smoothstep(0.35, 0.85, vCalor));
    brilho += quina * neon * (0.35 + 2.2 * vCalor * vCalor);
  } else {
    // telhado: borda acesa; arquivos quentes pulsam em vermelho e laranja
    vec2 q = abs(vLocal.xz);
    float borda = smoothstep(0.42, 0.5, max(q.x, q.y));
    float pulso = 0.6 + 0.4 * sin(uTempo * 2.6 + vSemente * 6.283);
    vec3 quente = mix(uQuente, uLaranja, 0.5 + 0.5 * sin(uTempo * 1.3 + vSemente * 4.0));
    brilho += borda * mix(uBorda * 0.8, quente * 2.2 * pulso, smoothstep(0.4, 0.9, vCalor));
    cor += quente * smoothstep(0.55, 1.0, vCalor) * 0.35 * pulso;
  }
  cor += brilho;
  // fora da busca: quase apagado e sem cor
  float cinza = dot(cor, vec3(0.299, 0.587, 0.114));
  cor = mix(cor, vec3(cinza) * 0.06, vApagado * 0.95);

  float alfa = 1.0;
#ifdef ESPELHO
  // reflexo: some com a distância da "água" e fica mais escuro
  alfa = (1.0 - smoothstep(0.0, 3.5, -vMundo.y)) * 0.32;
  cor *= 0.8;
#endif
  gl_FragColor = vec4(cor, alfa);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ---------- chão: vidro escuro com grade fina e um brilho violeta no centro ----------
export const chaoVertex = /* glsl */ `
varying vec3 vMundo;
#include <fog_pars_vertex>
void main() {
  vec4 mundo = modelMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  vec4 mvPosition = viewMatrix * mundo;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
export const chaoFragment = /* glsl */ `
uniform float uRaio;
uniform vec3 uFundo;
uniform vec3 uBrilho;
uniform vec3 uGrade;
varying vec3 vMundo;
#include <fog_pars_fragment>
void main() {
  float d = length(vMundo.xz) / uRaio;
  vec2 g = abs(fract(vMundo.xz / 1.6 - 0.5) - 0.5) / fwidth(vMundo.xz / 1.6);
  float linha = 1.0 - min(min(g.x, g.y), 1.0);
  vec3 cor = uFundo + uBrilho * (1.0 - smoothstep(0.0, 1.25, d)) * 0.55;
  cor += uGrade * linha * (1.0 - smoothstep(0.25, 1.1, d)) * 0.22;
  // deixa passar o reflexo dos prédios (o chão é um vidro escuro)
  gl_FragColor = vec4(cor, 0.78);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ---------- faixas de neon (bordas das quadras e ruas, com "fluxo" andando) ----------
export const faixaVertex = /* glsl */ `
attribute float aDist;  // distância ao longo da faixa (para o fluxo andar)
attribute float aTipo;  // 0 = borda de quadra, 1 = rua
varying float vDist;
varying float vTipo;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vDist = aDist; vTipo = aTipo; vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
export const faixaFragment = /* glsl */ `
uniform float uTempo;
uniform vec3 uRua;
uniform vec3 uQuadra;
uniform float uApagar;
varying float vDist;
varying float vTipo;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  float centro = 1.0 - abs(vUv.y - 0.5) * 2.0;           // mais forte no meio da faixa
  float fluxo = smoothstep(0.75, 1.0, fract(vDist * 0.35 - uTempo * 0.55));
  vec3 cor = vTipo > 0.5 ? uRua * (0.55 + 1.6 * fluxo) : uQuadra * 0.9;
  cor *= pow(centro, 0.6) * (1.0 - uApagar * 0.75);
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ---------- tráfego de dados: pontos que correm pelas ruas ----------
export const trafegoVertex = /* glsl */ `
attribute vec3 aIni;
attribute vec3 aFim;
attribute vec2 aMov; // x = velocidade (unidades/s), y = fase
uniform float uTempo;
uniform float uPixel;
varying float vVida;
#include <fog_pars_vertex>
void main() {
  float comp = max(distance(aIni, aFim), 0.001);
  float t = fract(uTempo * aMov.x / comp + aMov.y);
  vVida = sin(t * 3.14159);
  vec4 mvPosition = modelViewMatrix * vec4(mix(aIni, aFim, t), 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPixel * 7.0 / -mvPosition.z * (0.6 + 0.4 * vVida);
  #include <fog_vertex>
}`;
export const trafegoFragment = /* glsl */ `
uniform vec3 uCor;
varying float vVida;
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uCor * a * a * 2.4 * vVida, 1.0);
  #include <fog_fragment>
}`;

// ---------- faróis: feixe de luz que sai do topo dos arquivos mais alterados ----------
export const feixeVertex = /* glsl */ `
attribute float aFase;
varying vec2 vUv;
varying float vFase;
varying vec3 vNormal;
varying vec3 vMundo;
void main() {
  vUv = uv; vFase = aFase;
  vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * mundo;
}`;
export const feixeFragment = /* glsl */ `
uniform float uTempo;
uniform vec3 uQuente;
uniform vec3 uLaranja;
uniform float uApagar;
varying vec2 vUv;
varying float vFase;
varying vec3 vNormal;
varying vec3 vMundo;
void main() {
  float pulso = 0.55 + 0.45 * sin(uTempo * 2.6 + vFase * 6.283);
  vec3 cor = mix(uQuente, uLaranja, 0.5 + 0.5 * sin(uTempo * 1.3 + vFase * 4.0));
  vec3 olho = normalize(cameraPosition - vMundo);
  float lado = pow(abs(dot(normalize(vNormal), olho)), 1.5);   // mais denso no meio do cone
  float sobe = pow(1.0 - vUv.y, 2.2);                           // some para o alto
  float a = sobe * lado * pulso * (1.0 - uApagar * 0.85);
  gl_FragColor = vec4(cor * a * 1.6, 1.0);
}`;

// ---------- céu: degradê azul-marinho / violeta com estrelas ----------
export const ceuVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const ceuFragment = /* glsl */ `
uniform vec3 uHorizonte;
uniform vec3 uMeio;
uniform vec3 uTopo;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -1.0, 1.0);
  vec3 cor = mix(uHorizonte, uMeio, smoothstep(-0.05, 0.25, h));
  cor = mix(cor, uTopo, smoothstep(0.25, 0.9, h));
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const estrelasVertex = /* glsl */ `
attribute float aBrilho;
uniform float uTempo;
uniform float uPixel;
varying float vBrilho;
void main() {
  vBrilho = aBrilho * (0.7 + 0.3 * sin(uTempo * (0.6 + aBrilho) + position.x));
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPixel * (1.0 + aBrilho * 1.6);
}`;
export const estrelasFragment = /* glsl */ `
varying float vBrilho;
void main() {
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vec3(0.75, 0.8, 1.0) * a * vBrilho, 1.0);
}`;

// ---------- névoa em camadas: lençóis de neblina que andam devagar ----------
export const nevoaVertex = /* glsl */ `
varying vec3 vMundo;
void main() {
  vec4 mundo = modelMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}`;
export const nevoaFragment = /* glsl */ `
uniform float uTempo;
uniform float uRaio;
uniform vec3 uCor;
uniform float uForca;
varying vec3 vMundo;
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  vec2 p = vMundo.xz * 0.07 + vec2(uTempo * 0.012, uTempo * 0.007);
  float n = ruido(p) * 0.55 + ruido(p * 2.1 + 3.7) * 0.3 + ruido(p * 4.3 - 1.3) * 0.15;
  float borda = 1.0 - smoothstep(0.35, 1.0, length(vMundo.xz) / uRaio);
  float perto = smoothstep(6.0, 22.0, distance(cameraPosition, vMundo)); // de perto a neblina some (senão vira um véu leitoso)
  gl_FragColor = vec4(uCor, smoothstep(0.35, 0.85, n) * borda * perto * uForca);
}`;

// ---------- brilho falso (sem pós-processamento): halos suaves e aditivos no alto dos prédios ----------
// Funciona em qualquer placa: é só um ponto grande e transparente somado à tela, desenhado direto, sem imagem fora da tela.
export const haloVertex = /* glsl */ `
attribute vec3 aCor;
attribute vec3 aHalo;   // x = tamanho no mundo, y = altura do prédio, z = atraso da subida
attribute float aApagado;
uniform float uSubida;
uniform float uTempo;
uniform float uAltura;  // altura da tela em pixels
varying vec3 vCor;
varying float vApagado;
void main() {
  float sobe = smoothstep(aHalo.z, aHalo.z + 0.75, uSubida);
  vec3 p = position;
  p.y += aHalo.y * sobe;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float pulso = 1.0 + 0.12 * sin(uTempo * 2.6 + position.x * 1.7 + position.z);
  gl_PointSize = min(aHalo.x * projectionMatrix[1][1] * uAltura * 0.5 / -mvPosition.z * pulso, 256.0) * sobe;
  vCor = aCor;
  vApagado = aApagado;
}`;
export const haloFragment = /* glsl */ `
varying vec3 vCor;
varying float vApagado;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 4.0) * (1.0 - smoothstep(0.8, 1.0, d));
  gl_FragColor = vec4(vCor * a * (1.0 - vApagado * 0.9), 1.0);
}`;
