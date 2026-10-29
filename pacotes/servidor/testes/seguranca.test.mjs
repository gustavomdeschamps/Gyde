// Testes das proteções da Forja (node --test app/testes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { classificarComando, redigir, caminhoSeguro, ARQUIVO_SECRETO, ambienteLimpo } from '../seguranca.ts';

test('comandos perigosos são bloqueados', () => {
  for (const c of ['format c:', 'shutdown /s', 'del /s /q C:\\', 'rd /s /q c:', 'reg delete HKLM\\x', 'echo %FREELLMAPI_KEY%', 'echo $env:GEMINI_API_KEY', 'type .env', 'type C:\\Windows\\win.ini', 'Set-ExecutionPolicy Bypass']) {
    assert.equal(classificarComando(c).nivel, 'bloqueado', c);
  }
});
test('comandos de risco pedem confirmação', () => {
  for (const c of ['del calc.js', 'rm -rf build', 'git push origin main', 'git reset --hard HEAD~1', 'npm install left-pad', 'pip install requests', 'curl https://x.com', 'npm test > saida.txt', 'npm publish']) {
    assert.equal(classificarComando(c).nivel, 'confirmar', c);
  }
});
test('comandos comuns rodam direto', () => {
  for (const c of ['npm test', 'node teste.js', 'python -m pytest', 'git status', 'git diff', 'node -e "const f = (x) => x; console.log(process.env.PATH ? 1 : 0)"', 'npm test 2>&1', 'dir', 'python main.py']) {
    assert.equal(classificarComando(c).nivel, 'livre', c);
  }
});
test('segredos são removidos do texto', () => {
  // chaves FALSAS montadas em pedaços: o arquivo não tem nada com cara de chave (o scanner de segredos do GitHub
  // apontaria como vazamento), mas o texto testado tem o formato exato de uma
  const google = ['AIza', 'SyA', '1234567890', 'abcdefghijklmnopqrstuv'].join('');
  const openai = ['sk-', 'proj-', 'abcdefghijklmnopqrstuvwx'].join('');
  const pem = ['-----BEGIN RSA ', 'PRIVATE KEY-----\nabc\n-----END RSA ', 'PRIVATE KEY-----'].join('');
  const t = redigir(`chave ${google} e ${openai}\nAPI_KEY=supersecreto123\npassword: "hunter2hunter2"\n${pem}`);
  assert.ok(!/AIzaSy|sk-proj|supersecreto|hunter2|BEGIN RSA/.test(t), t);
  assert.match(t, /API_KEY=\[segredo removido\]/);
  assert.equal(redigir('const total = soma(a, b);'), 'const total = soma(a, b);');
});
test('arquivos de segredos são reconhecidos', () => {
  for (const f of ['.env', 'app/.env.local', '.ssh/id_rsa', 'id_ed25519', 'cert.pem', '.npmrc', 'credentials.json', 'secrets.yaml', 'segredos.json', 'config/senhas.txt', 'credenciais.yml', 'chat.db']) assert.ok(ARQUIVO_SECRETO.test(f), f);
  for (const f of ['env.js', 'src/environment.ts', 'README.md', 'keys.js']) assert.ok(!ARQUIVO_SECRETO.test(f), f);
});
test('caminhos não escapam da pasta (.., absoluto, atalho)', () => {
  const raiz = realpathSync(mkdtempSync(path.join(tmpdir(), 'forja-'))), fora = realpathSync(mkdtempSync(path.join(tmpdir(), 'fora-')));
  mkdirSync(path.join(raiz, 'src')); writeFileSync(path.join(fora, 'segredo.txt'), 'x');
  assert.equal(caminhoSeguro(raiz, 'src/novo.js'), path.join(raiz, 'src', 'novo.js'));
  assert.throws(() => caminhoSeguro(raiz, '../fora.txt'), /fora da pasta/);
  assert.throws(() => caminhoSeguro(raiz, fora), /fora da pasta/);
  assert.throws(() => caminhoSeguro(raiz, '.env'), /senhas ou chaves/);
  let link = false;
  try { symlinkSync(fora, path.join(raiz, 'atalho'), 'junction'); link = true; } catch { /* sem permissão para criar atalho */ }
  if (link) assert.throws(() => caminhoSeguro(raiz, 'atalho/segredo.txt'), /atalho/);
  // Windows com nome curto (8.3) na pasta, como C:\Users\RUNNER~1 no GitHub: continua dentro da pasta
  if (process.platform === 'win32') {
    const curto = spawnSync('powershell', ['-NoProfile', '-Command', `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${raiz}').ShortPath`], { encoding: 'utf8' }).stdout.trim();
    if (curto && curto !== raiz) {
      assert.equal(caminhoSeguro(curto, 'src/novo.js'), path.join(curto, 'src', 'novo.js'));
      if (link) assert.throws(() => caminhoSeguro(curto, 'atalho/segredo.txt'), /atalho/);
    }
  }
  rmSync(raiz, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); rmSync(fora, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
});
test('comandos não recebem as chaves do Gyde', () => {
  process.env.FREELLMAPI_KEY = 'freellmapi-teste'; process.env.MEU_TOKEN = 'x'; process.env.PATH ||= 'p';
  const env = ambienteLimpo();
  assert.equal(env.FREELLMAPI_KEY, undefined); assert.equal(env.MEU_TOKEN, undefined); assert.ok(env.PATH);
});
