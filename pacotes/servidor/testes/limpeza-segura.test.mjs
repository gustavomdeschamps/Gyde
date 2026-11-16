// Limpeza só por lista explícita de caminhos permitidos, sem seguir atalhos. Falha se alguma limpeza (das
// ferramentas em Node ou do limpar-antigos.ps1) apagar fora da lista ou atravessar uma junction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, utimesSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apagarSeguro, motivoParaRecusar, PROJETO } from '../../../ferramentas/limpeza-segura.mjs';

const atalho = (destino, onde) => symlinkSync(destino, onde, process.platform === 'win32' ? 'junction' : 'dir');
const arquivo = (p, t = 'x') => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, t); };
const raizTeste = () => mkdtempSync(path.join(tmpdir(), 'teste-limpeza-')); // fora do padrão gyde-*: nunca casa com a lista padrão
const limpar = (p) => apagarSeguro(p, [{ raiz: tmpdir(), padrao: 'teste-limpeza-*' }]);

test('Node: recusa o que está fora da lista, a raiz, o projeto, .env e data', () => {
  const raiz = raizTeste();
  try {
    const lista = [{ raiz, padrao: 'gyde-*' }];
    arquivo(path.join(raiz, 'outro', 'a.txt'));
    assert.match(motivoParaRecusar(path.join(raiz, 'outro'), lista), /fora da lista/);
    assert.throws(() => apagarSeguro(path.join(raiz, 'outro'), lista), /Limpeza recusada/);
    assert.ok(existsSync(path.join(raiz, 'outro', 'a.txt')));
    assert.match(motivoParaRecusar(raiz, lista), /fora da lista/, 'a própria raiz nunca');
    for (const p of [PROJETO, path.join(PROJETO, 'pacotes'), path.join(PROJETO, '.env'), path.join(PROJETO, 'data')]) {
      assert.ok(motivoParaRecusar(p, [{ raiz: path.dirname(PROJETO), padrao: '*' }]), `deveria recusar ${p}`);
    }
    assert.ok(motivoParaRecusar(path.dirname(PROJETO), [{ raiz: path.dirname(path.dirname(PROJETO)), padrao: '*' }]), 'pasta que contém o projeto');
    assert.match(motivoParaRecusar(path.join(raiz, '..', path.basename(raiz), 'gyde-x', '..', '..'), lista), /fora da lista/, 'escapar com ..');
  } finally { limpar(raiz); }
});

test('Node: apaga o que está na lista e não segue atalho (o destino fica intacto)', () => {
  const raiz = raizTeste();
  try {
    const lista = [{ raiz, padrao: 'gyde-*' }];
    const fora = path.join(raiz, 'fora');
    arquivo(path.join(fora, 'importante.txt'), 'não apagar');
    arquivo(path.join(raiz, 'gyde-copia', 'sub', 'b.txt'));
    atalho(fora, path.join(raiz, 'gyde-copia', 'node_modules'));
    atalho(fora, path.join(raiz, 'gyde-copia', 'sub', 'outro-atalho'));
    apagarSeguro(path.join(raiz, 'gyde-copia'), lista);
    assert.ok(!existsSync(path.join(raiz, 'gyde-copia')), 'apagou o que estava na lista');
    assert.ok(existsSync(path.join(fora, 'importante.txt')), 'não seguiu o atalho');
    apagarSeguro(path.join(raiz, 'gyde-nao-existe'), lista); // não existe: nada a fazer, sem erro
  } finally { limpar(raiz); }
});

const powershell = process.platform === 'win32' && spawnSync('powershell', ['-NoProfile', '-Command', 'exit 0']).status === 0;
const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../ferramentas/atualizar');
const ps = (comando) => spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', comando], { encoding: 'utf8' });

test('limpar-antigos.ps1: só apaga pela lista e não atravessa junction', { skip: !powershell && 'só no Windows com PowerShell' }, () => {
  const raiz = raizTeste();
  try {
    const projeto = path.join(raiz, 'Gyde'), backups = path.join(raiz, 'Gyde-backups'), temp = path.join(raiz, 'temp'), appdata = path.join(raiz, 'appdata');
    const fora = path.join(raiz, 'fora');
    arquivo(path.join(fora, 'importante.txt'));
    arquivo(path.join(projeto, '.env'), 'X=1'); arquivo(path.join(projeto, 'data', 'chat.db'));
    arquivo(path.join(projeto, 'pacotes', 'servidor', 'a.ts'));
    const antigo = path.join(projeto, 'dist-desktop', 'Gyde-Setup-1.0.0.exe'), novo = path.join(projeto, 'dist-desktop', 'Gyde-Setup-2.0.0.exe');
    arquivo(antigo); arquivo(antigo + '.blockmap'); arquivo(novo); arquivo(path.join(projeto, 'dist-desktop', 'leia.txt'));
    utimesSync(antigo, new Date(2020, 0, 1), new Date(2020, 0, 1));
    arquivo(path.join(temp, 'gyde-sobra', 'x.txt'));
    atalho(fora, path.join(temp, 'gyde-sobra', 'node_modules'));
    atalho(path.join(projeto, 'pacotes'), path.join(temp, 'gyde-sobra', 'pacotes'));
    arquivo(path.join(temp, 'outro-programa', 'y.txt'));
    arquivo(path.join(appdata, 'Gyde', 'gyde.db'));
    for (let i = 0; i < 7; i++) { const c = path.join(backups, `Gyde-dados-2020-01-0${i + 1}`); arquivo(path.join(c, 'gyde.db')); utimesSync(c, new Date(2020, 0, i + 1), new Date(2020, 0, i + 1)); }
    const r = ps(`& '${path.join(SCRIPTS, 'limpar-antigos.ps1')}' -Projeto '${projeto}' -Backups '${backups}' -Temp '${temp}' -AppData '${appdata}' -Confirmar -SemPausa`);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!existsSync(antigo) && !existsSync(antigo + '.blockmap'), 'instalador antigo saiu');
    assert.ok(existsSync(novo) && existsSync(path.join(projeto, 'dist-desktop', 'leia.txt')), 'o mais novo e o que não é instalador ficam');
    assert.ok(!existsSync(path.join(temp, 'gyde-sobra')), 'temporário gyde-* saiu');
    assert.ok(existsSync(path.join(temp, 'outro-programa', 'y.txt')), 'temporário de outro programa fica');
    assert.ok(existsSync(path.join(fora, 'importante.txt')), 'não atravessou a junction');
    assert.ok(existsSync(path.join(projeto, 'pacotes', 'servidor', 'a.ts')), 'não atravessou a junction para o projeto');
    for (const p of [path.join(projeto, '.env'), path.join(projeto, 'data', 'chat.db'), path.join(appdata, 'Gyde', 'gyde.db')]) assert.ok(existsSync(p), `protegido: ${p}`);
    assert.ok(!existsSync(path.join(backups, 'Gyde-dados-2020-01-01')) && !existsSync(path.join(backups, 'Gyde-dados-2020-01-02')), 'cópias além das 5 e antigas saem');
    for (let i = 3; i <= 7; i++) assert.ok(existsSync(path.join(backups, `Gyde-dados-2020-01-0${i}`)), 'ficam as 5 mais recentes');
  } finally { limpar(raiz); }
});

test('limpeza-segura.ps1: Remove-Seguro recusa caminho fora da lista e protegido', { skip: !powershell && 'só no Windows com PowerShell' }, () => {
  const raiz = raizTeste();
  try {
    arquivo(path.join(raiz, 'fora', 'a.txt')); arquivo(path.join(raiz, 'lixo', '.env'));
    const lista = `@(@{ Raiz = '${path.join(raiz, 'lixo')}'; Padrao = '*' })`;
    const tenta = (alvo) => ps(`. '${path.join(SCRIPTS, 'limpeza-segura.ps1')}'; try { Remove-Seguro '${alvo}' ${lista} @() ; 'APAGOU' } catch { 'RECUSOU' }`).stdout.trim();
    assert.equal(tenta(path.join(raiz, 'fora')), 'RECUSOU');
    assert.equal(tenta(path.join(raiz, 'lixo')), 'RECUSOU', 'a raiz em si');
    assert.equal(tenta(path.join(raiz, 'lixo', '.env')), 'RECUSOU');
    assert.ok(existsSync(path.join(raiz, 'fora', 'a.txt')) && existsSync(path.join(raiz, 'lixo', '.env')));
  } finally { limpar(raiz); }
});
