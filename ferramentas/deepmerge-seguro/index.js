'use strict';
// Substituto do pacote "deepmerge" (usado só pelo @sveltejs/vite-plugin-svelte, na hora de gerar a interface).
// O deepmerge 4.x tem o alerta GHSA-gcqx-w48m-w2h4 (prototype poisoning) e não há versão corrigida; esta versão tem a
// mesma interface documentada (arrayMerge, isMergeableObject, clone, customMerge, deepmerge.all), mas nunca copia as
// chaves __proto__, constructor e prototype. Ligado pelo "overrides" do package.json da raiz.

const CHAVES_PERIGOSAS = new Set(['__proto__', 'constructor', 'prototype']);

function isMergeableObject(valor) {
  if (!valor || typeof valor !== 'object') return false;
  const tipo = Object.prototype.toString.call(valor);
  return tipo !== '[object RegExp]' && tipo !== '[object Date]' && valor.$$typeof !== Symbol.for('react.element');
}

const vazioDe = (valor) => (Array.isArray(valor) ? [] : {});
const clonarSePreciso = (valor, opcoes) => (opcoes.clone !== false && opcoes.isMergeableObject(valor) ? deepmerge(vazioDe(valor), valor, opcoes) : valor);
const juntarArrays = (alvo, origem, opcoes) => alvo.concat(origem).map((item) => clonarSePreciso(item, opcoes));
const chavesDe = (obj) => Object.keys(obj).concat(Object.getOwnPropertySymbols(obj).filter((s) => Object.prototype.propertyIsEnumerable.call(obj, s)));
const funcaoDe = (chave, opcoes) => {
  if (!opcoes.customMerge) return deepmerge;
  const f = opcoes.customMerge(chave);
  return typeof f === 'function' ? f : deepmerge;
};

function juntarObjetos(alvo, origem, opcoes) {
  const destino = {};
  if (opcoes.isMergeableObject(alvo)) {
    for (const chave of chavesDe(alvo)) if (!CHAVES_PERIGOSAS.has(chave)) destino[chave] = clonarSePreciso(alvo[chave], opcoes);
  }
  for (const chave of chavesDe(origem)) {
    if (CHAVES_PERIGOSAS.has(chave)) continue;
    const temNoAlvo = Object.prototype.hasOwnProperty.call(alvo, chave);
    destino[chave] = temNoAlvo && opcoes.isMergeableObject(origem[chave])
      ? funcaoDe(chave, opcoes)(alvo[chave], origem[chave], opcoes)
      : clonarSePreciso(origem[chave], opcoes);
  }
  return destino;
}

function deepmerge(alvo, origem, opcoesRecebidas) {
  const opcoes = { ...(opcoesRecebidas || {}) };
  opcoes.arrayMerge = opcoes.arrayMerge || juntarArrays;
  opcoes.isMergeableObject = opcoes.isMergeableObject || isMergeableObject;
  opcoes.cloneUnlessOtherwiseSpecified = clonarSePreciso;
  const origemArray = Array.isArray(origem), alvoArray = Array.isArray(alvo);
  if (origemArray !== alvoArray) return clonarSePreciso(origem, opcoes);
  if (origemArray) return opcoes.arrayMerge(alvo, origem, opcoes);
  return juntarObjetos(alvo, origem, opcoes);
}

deepmerge.all = function all(lista, opcoes) {
  if (!Array.isArray(lista)) throw new Error('first argument should be an array');
  return lista.reduce((anterior, atual) => deepmerge(anterior, atual, opcoes), {});
};

module.exports = deepmerge;
module.exports.default = deepmerge;
