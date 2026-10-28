// Contratos da API: as regras que garantem que a tela nunca recebe um estado impossível.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../compartilhado/contratos.ts';

test('pasta indisponível sem explicação é recusada (a tela não pode mostrar "removida" sem motivo)', () => {
  assert.equal(C.EstadoPasta.safeParse({ ok: false, motivo: 'nao-encontrada', texto: null }).success, false);
  assert.equal(C.EstadoPasta.safeParse({ ok: false, motivo: 'nao-encontrada', texto: 'A pasta X não foi encontrada.' }).success, true);
  assert.equal(C.EstadoPasta.safeParse({ ok: true, motivo: null, texto: null }).success, true);
});

test('sessão da Forja: "existe" precisa concordar com o estado da pasta', () => {
  const base = { id: 'a', user_id: 'u', pasta: 'C:\\p', titulo: 't', created_at: 1, updated_at: 1, projeto: null, podeDesfazer: false, trabalhando: false, eventos: [] };
  assert.equal(C.SessaoForja.safeParse({ ...base, existe: false, pastaEstado: { ok: true, motivo: null, texto: null } }).success, false);
  assert.equal(C.SessaoForja.safeParse({ ...base, existe: true, pastaEstado: { ok: true, motivo: null, texto: null } }).success, true);
  // resposta antiga, sem o estado da pasta: fora do contrato (era o bug do aviso falso)
  assert.equal(C.SessaoForja.safeParse({ ...base, existe: true }).success, false);
});

test('plano sem próximo passo só vale se estiver concluído e com novo desafio', () => {
  const plano = {
    versao: 2, tipo: 'inicial', explicacao: 'x', nivel: 'básico', tecnologias: ['Python'], tecnologiasDeduzidas: true, temQuiz: false,
    declarado: null, medido: null, observado: { feitos: 0, tentativasComErro: 0, travados: [] }, focos: [], ordem: [], motivos: {},
    recomendada: null, guiados: [], semTrilha: [],
  };
  assert.equal(C.Plano.safeParse({ ...plano, proximo: null, concluido: false, novoDesafio: null }).success, false);
  assert.equal(C.Plano.safeParse({ ...plano, proximo: null, concluido: true, novoDesafio: { tipo: 'chat', titulo: 'Peça um desafio' } }).success, true);
  assert.equal(C.Plano.safeParse({ ...plano, proximo: { tipo: 'guiado', id: 'g', titulo: 't', tecnologia: 'SQL' }, concluido: false, novoDesafio: null }).success, true);
  // resposta antiga, sem "plano": a Prática recusa (era o bug do "reading 'proximo'")
  assert.equal(C.EstadoPratica.shape.plano.safeParse(undefined).success, false);
});

test('preferências: página inicial só aceita as páginas que existem', () => {
  assert.equal(C.Preferencias.safeParse({ about_user: '', response_style: '', pagina_inicial: 'qualquer' }).success, false);
  assert.equal(C.Preferencias.safeParse({ about_user: '', response_style: '', pagina_inicial: 'agente' }).success, true);
});

test('responder(): modo estrito devolve 500 explicando; modo normal envia e registra no console', async () => {
  const falso = () => { const r = { req: { method: 'GET', originalUrl: '/api/teste' }, codigo: 0, corpo: null, status(c) { r.codigo = c; return r; }, json(b) { r.corpo = b; return r; } }; return r; };
  const erros = []; const original = console.error; console.error = (m) => erros.push(m);
  try {
    process.env.GYDE_CONTRATOS = 'estrito';
    const estrito = (await import(`../contratos-servidor.ts?estrito=${Date.now()}`)).responder;
    const r1 = falso(); estrito(r1, C.Status, { keyConfigured: true });
    assert.equal(r1.codigo, 500); assert.match(r1.corpo.error, /fora do contrato em GET \/api\/teste/);
    delete process.env.GYDE_CONTRATOS;
    const normal = (await import(`../contratos-servidor.ts?normal=${Date.now()}`)).responder;
    const r2 = falso(); normal(r2, C.Status, { keyConfigured: true });
    assert.equal(r2.codigo, 200); assert.deepEqual(r2.corpo, { keyConfigured: true });
    assert.ok(erros.length === 2 && erros.every((e) => /fora do contrato/.test(e)));
  } finally { console.error = original; }
});
