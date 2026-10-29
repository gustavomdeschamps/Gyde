// Mapa de habilidades: toda tecnologia do questionário aparece, com itens nos três níveis, links que existem e o
// estado tirado só do progresso salvo (feito = dominado, tentou sem acertar = praticando, nada = novo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapaDe } from '../pratica-mapa.ts';
import { TECNOLOGIAS } from '../pratica-plano.ts';
import { TRACKS } from '../pratica-dados.ts';
import { PROJETOS, chaveEtapa } from '../projetos-dados.ts';
import { MapaHabilidades } from '../../compartilhado/contratos.ts';

test('toda tecnologia aparece, com itens nos três níveis e links válidos', () => {
  const mapa = mapaDe({});
  assert.deepEqual(mapa.map((t) => t.tecnologia), TECNOLOGIAS);
  assert.ok(MapaHabilidades.safeParse({ tecnologias: mapa }).success);
  for (const t of mapa) {
    for (const nivel of ['basico', 'intermediario', 'avancado']) assert.ok(t.nos.some((n) => n.nivel === nivel), `${t.tecnologia} sem ${nivel}`);
    assert.equal(new Set(t.nos.map((n) => n.id)).size, t.nos.length, `${t.tecnologia}: itens repetidos`);
    for (const n of t.nos) {
      if (n.tipo === 'exercicio') { const [, , trilha, ex] = n.link.split('/'); assert.ok(TRACKS.find((x) => x.id === trilha)?.exercises.some((e) => e.id === ex), n.link); }
      if (n.tipo === 'etapa') assert.ok(PROJETOS.some((p) => n.link === `#/pratica/projeto/${p.id}`), n.link);
    }
    assert.equal(t.dominados, 0);
  }
});

test('estado vem do progresso: feito, tentou sem acertar e nada', () => {
  const etapa = chaveEtapa('pj-sql-escola', 'tabelas');
  const mapa = mapaDe({ 'py-ola': { done: true }, 'py-area': { done: false, fails: 2 }, [etapa]: { done: true } });
  const py = mapa.find((t) => t.tecnologia === 'Python');
  assert.equal(py.nos.find((n) => n.id === 'py-ola').estado, 'dominado');
  assert.equal(py.nos.find((n) => n.id === 'py-area').estado, 'praticando');
  assert.equal(py.nos.find((n) => n.id === 'py-par').estado, 'novo');
  assert.equal(py.dominados, 1);
  const sql = mapa.find((t) => t.tecnologia === 'SQL');
  assert.equal(sql.nos.find((n) => n.id === etapa).estado, 'dominado');
  assert.equal(sql.dominados, 1);
  // ordem: básico antes de intermediário antes de avançado
  const ordem = sql.nos.map((n) => ['basico', 'intermediario', 'avancado'].indexOf(n.nivel));
  assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b));
});
