// Projetos guiados: cobertura de todas as tecnologias do questionário, critérios que medem alguma coisa
// (a referência passa, o arquivo inicial e os erros comuns não), e nada da solução vai para o navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJETOS, findProjeto, conferirEtapa, semComentarios, projetoPublico, chaveEtapa } from '../projetos-dados.ts';
import { TECNOLOGIAS, planoDe } from '../pratica-plano.ts';
import { QUIZ, gradeQuiz } from '../quiz.ts';
import { ProjetoGuiado } from '../../compartilhado/contratos.ts';

const etapa = (projetoId, etapaId) => { const p = findProjeto(projetoId); return [p, p.etapas.find((e) => e.id === etapaId)]; };
const confere = (projetoId, etapaId, codigo) => { const [p, e] = etapa(projetoId, etapaId); return conferirEtapa(p, e, codigo); };

test('toda tecnologia do questionário tem projeto guiado completo', () => {
  const doQuiz = QUIZ.find((q) => q.id === 'languages').options.filter((o) => o !== 'Ainda não sei');
  for (const t of [...doQuiz, 'Lógica']) assert.ok(TECNOLOGIAS.includes(t), t);
  for (const t of TECNOLOGIAS) {
    const ps = PROJETOS.filter((p) => p.tecnologia === t);
    assert.ok(ps.length >= 1, `sem projeto para ${t}`);
    for (const p of ps) {
      assert.ok(p.nome.length >= 8, `${p.id}.nome`);
      for (const campo of ['descricao', 'objetivo', 'resultado', 'explicacaoSolucao']) assert.ok(p[campo].length > 40, `${p.id}.${campo}`);
      for (const lista of ['tecnologias', 'prerequisitos', 'arquivos', 'etapas', 'proximosDesafios']) assert.ok(p[lista].length >= 1, `${p.id}.${lista}`);
      assert.ok(p.etapas.length >= 2, `${p.id} com uma etapa só`);
      for (const e of p.etapas) {
        assert.ok(e.tarefas.length && e.criterios.length >= 3 && e.dica && e.explicacao && e.xp > 0, `${p.id}/${e.id} incompleta`);
        assert.ok(p.arquivos.some((a) => a.nome === e.arquivo), `${p.id}/${e.id}: arquivo ${e.arquivo} não está nos arquivos iniciais`);
        for (const c of e.criterios) assert.doesNotThrow(() => new RegExp(c.padrao, c.flags ?? 'm'), `${p.id}/${e.id}: ${c.descricao}`);
      }
    }
  }
  assert.equal(new Set(PROJETOS.map((p) => p.id)).size, PROJETOS.length);
});

test('a solução de referência passa e o arquivo inicial não passa, em toda etapa', () => {
  for (const p of PROJETOS) for (const e of p.etapas) {
    const r = conferirEtapa(p, e, e.referencia);
    assert.ok(r.ok, `${p.id}/${e.id}: referência falha em ${r.criterios.filter((c) => !c.ok).map((c) => c.descricao).join(', ')}`);
    assert.equal(conferirEtapa(p, e, p.arquivos.find((a) => a.nome === e.arquivo).conteudo).ok, false, `${p.id}/${e.id}: arquivo inicial já passa`);
    assert.equal(conferirEtapa(p, e, '').ok, false, `${p.id}/${e.id}: vazio passa`);
  }
});

test('cada critério sozinho faz diferença: tirar o trecho que ele pede reprova a referência', () => {
  // para cada critério "positivo", apaga da referência tudo o que ele casa; a etapa precisa reprovar nesse critério
  for (const p of PROJETOS) for (const e of p.etapas) for (const c of e.criterios.filter((x) => !x.ausente)) {
    const sem = semComentarios(e.referencia, p.tecnologia).replace(new RegExp(c.padrao, (c.flags ?? 'm').replace('g', '') + 'g'), ' ');
    const r = conferirEtapa(p, e, sem);
    assert.equal(r.criterios.find((x) => x.descricao === c.descricao).ok, false, `${p.id}/${e.id}: "${c.descricao}" continua passando sem o trecho`);
  }
});

test('erros comuns são reprovados', () => {
  const [, c2] = etapa('pj-c-agenda', 'adicionar');
  const comGets = c2.referencia.replace('fgets(destino, tamanho, stdin)', 'gets(destino)');
  assert.equal(confere('pj-c-agenda', 'adicionar', comGets).criterios.find((c) => c.descricao === 'não usa gets').ok, false);
  const [, sql] = etapa('pj-sql-escola', 'relatorios');
  assert.equal(confere('pj-sql-escola', 'relatorios', sql.referencia + '\nSELECT * FROM alunos;').ok, false);
  const [, cs] = etapa('pj-csharp-estoque', 'entrada');
  assert.equal(confere('pj-csharp-estoque', 'entrada', cs.referencia + '\nint x = int.Parse(Console.ReadLine());').ok, false);
  const [, kt] = etapa('pj-kotlin-habitos', 'menu');
  assert.equal(confere('pj-kotlin-habitos', 'menu', kt.referencia.replace('?.toIntOrNull() ?: continue', '!!.toInt()')).ok, false);
  const [, php] = etapa('pj-php-recados', 'gravar');
  const injetavel = php.referencia.replace(/\$st = [\s\S]*?execute\(\[[^\]]*\]\);/, '$pdo->exec("INSERT INTO recados (nome) VALUES (\'" . $_POST["nome"] . "\')");');
  assert.equal(confere('pj-php-recados', 'gravar', injetavel).ok, false);
  const [, html] = etapa('pj-web-portfolio', 'estrutura');
  assert.equal(confere('pj-web-portfolio', 'estrutura', html.referencia.replace(' alt="Tela do app de tarefas"', '')).ok, false);
  const [, js] = etapa('pj-js-pomodoro', 'contar');
  assert.equal(confere('pj-js-pomodoro', 'contar', js.referencia.replace('textContent', 'innerHTML')).ok, false);
});

test('critério escrito só num comentário não conta', () => {
  assert.equal(confere('pj-python-gastos', 'registrar', '# def adicionar_gasto(gastos, descricao, valor):\n# if valor <= 0: raise ValueError("x")\n# gastos.append(1)\n').ok, false);
  assert.equal(confere('pj-sql-escola', 'tabelas', '-- CREATE TABLE turmas (id INTEGER PRIMARY KEY);\n/* REFERENCES alunos(id) */').ok, false);
  assert.equal(confere('pj-java-biblioteca', 'livro', '// throw new IllegalStateException("x")\n/* public Livro(String titulo, String autor) */').ok, false);
  // URL dentro de string não é comentário em JavaScript
  assert.equal(semComentarios('const u = "https://exemplo.com";', 'JavaScript'), 'const u = "https://exemplo.com";');
});

test('o navegador não recebe a solução nem os padrões; a explicação só aparece no fim', () => {
  for (const p of PROJETOS) {
    const nada = projetoPublico(p, () => false);
    const texto = JSON.stringify(nada);
    assert.ok(!/"(referencia|padrao|flags|ausente)"/.test(texto), `${p.id}: campo interno foi para o navegador`);
    for (const e of p.etapas) assert.ok(!texto.includes(JSON.stringify(e.referencia).slice(1, -1)), `${p.id}/${e.id}: referência vazou`);
    assert.equal(nada.explicacaoSolucao, null);
    assert.equal(nada.concluido, false);
    assert.ok(ProjetoGuiado.safeParse(nada).success, p.id);
    const meio = projetoPublico(p, (id) => id === chaveEtapa(p.id, p.etapas[0].id));
    assert.equal(meio.explicacaoSolucao, null);
    const tudo = projetoPublico(p, () => true);
    assert.equal(tudo.concluido, true);
    assert.equal(tudo.explicacaoSolucao, p.explicacaoSolucao);
    assert.ok(ProjetoGuiado.safeParse(tudo).success, p.id);
  }
});

test('plano: cada combinação de linguagens traz os projetos dessas linguagens; o próximo avança pelas etapas', () => {
  const opcoes = QUIZ.find((q) => q.id === 'languages').options.filter((o) => o !== 'Ainda não sei');
  for (let mascara = 1; mascara < 1 << opcoes.length; mascara++) {
    const langs = opcoes.filter((_, i) => mascara & (1 << i));
    const plano = planoDe(gradeQuiz({ languages: langs }).profile, {});
    for (const t of plano.tecnologias) assert.ok(plano.projetos.some((id) => findProjeto(id).tecnologia === t), `${langs}: sem projeto de ${t}`);
  }
  // SQL não tem trilha com testes: depois dos guiados, o próximo passo é o projeto, etapa por etapa
  const perfil = gradeQuiz({ languages: ['SQL'] }).profile;
  const guiadosFeitos = Object.fromEntries(planoDe(perfil, {}).guiados.map((g) => [g.id, { done: true }]));
  const p1 = planoDe(perfil, guiadosFeitos);
  assert.deepEqual([p1.proximo.tipo, p1.proximo.id, p1.proximo.etapaId], ['projeto', 'pj-sql-escola', 'tabelas']);
  const p2 = planoDe(perfil, { ...guiadosFeitos, [chaveEtapa('pj-sql-escola', 'tabelas')]: { done: true } });
  assert.equal(p2.proximo.etapaId, 'dados');
  // etapa conferida mas reprovada (done: false) continua sendo o próximo passo
  const p3 = planoDe(perfil, { ...guiadosFeitos, [chaveEtapa('pj-sql-escola', 'tabelas')]: { done: false, fails: 2 } });
  assert.equal(p3.proximo.etapaId, 'tabelas');
});
