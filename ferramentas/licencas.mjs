// Licenças das dependências que vão dentro do app (as de produção, com as dependências delas). Escreve a tabela em
// LICENCAS-DE-TERCEIROS.md, entre as marcas, e recusa licença que não permite distribuir junto (GPL, AGPL, LGPL, SSPL,
// sem licença). Ferramentas de desenvolvimento (eslint, vite, electron-builder...) não vão no app e ficam de fora.
//   node ferramentas/licencas.mjs            atualiza a tabela
//   node ferramentas/licencas.mjs --conferir só confere (sai com erro se estiver desatualizada ou com licença proibida)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const DOC = path.join(RAIZ, 'LICENCAS-DE-TERCEIROS.md');
const INICIO = '<!-- dependencias:inicio (gerado por ferramentas/licencas.mjs; não edite à mão) -->';
const FIM = '<!-- dependencias:fim -->';
const PERMITIDAS = /^(MIT|MIT-0|ISC|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|BlueOak-1\.0\.0|CC0-1\.0|Unlicense|Python-2\.0|Zlib|WTFPL|MPL-2\.0)$/;

/** Uma expressão como "(MIT OR Apache-2.0)" vale se ao menos uma opção for permitida; "A AND B" se todas forem. */
export function licencaPermitida(expr) {
  const e = String(expr || '').replace(/[()]/g, '').trim();
  if (!e) return false;
  if (/ OR /i.test(e)) return e.split(/ OR /i).some((x) => licencaPermitida(x));
  if (/ AND /i.test(e)) return e.split(/ AND /i).every((x) => licencaPermitida(x));
  return PERMITIDAS.test(e);
}

export function dependenciasDoApp() {
  const r = spawnSync('npm ls --omit=dev --all --json --long', { cwd: RAIZ, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 }) // texto fixo, sem nada de fora;
  const arvore = JSON.parse(r.stdout || '{}');
  const achadas = new Map();
  const anda = (no) => {
    for (const [nome, d] of Object.entries(no.dependencies ?? {})) {
      // pacotes do próprio repositório (pacotes/*, inclusive a extensão "gyde") não são de terceiros
      const doProjeto = nome.startsWith('@gyde/') || String(d.resolved ?? '').startsWith('file:');
      if (!d || doProjeto || !d.version) { if (d) anda(d); continue; }
      const chave = `${nome}@${d.version}`;
      if (achadas.has(chave)) continue;
      let licenca = d.license;
      if (!licenca && d.path && existsSync(path.join(d.path, 'package.json'))) licenca = JSON.parse(readFileSync(path.join(d.path, 'package.json'), 'utf8')).license;
      if (licenca && typeof licenca === 'object') licenca = licenca.type;
      achadas.set(chave, { nome, versao: d.version, licenca: licenca || 'sem licença declarada', site: d.homepage || '' });
      anda(d);
    }
  };
  anda(arvore);
  return [...achadas.values()].sort((a, b) => a.nome.localeCompare(b.nome) || a.versao.localeCompare(b.versao));
}

export function tabela(deps) {
  const linhas = deps.map((d) => `| ${d.nome} | ${d.versao} | ${d.licenca} |`);
  return [INICIO, '', `${deps.length} pacotes vão dentro do app (dependências de produção e as dependências delas). O texto de cada licença fica`, 'na pasta do pacote, em `node_modules`. O Electron inclui no instalador as licenças do Chromium e do Node.js.', '', '| Pacote | Versão | Licença |', '|---|---|---|', ...linhas, '', FIM].join('\n');
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('licencas.mjs')) {
  const deps = dependenciasDoApp();
  const proibidas = deps.filter((d) => !licencaPermitida(d.licenca));
  const doc = readFileSync(DOC, 'utf8');
  const nl = doc.includes('\r\n') ? '\r\n' : '\n';
  const novo = tabela(deps).replace(/\n/g, nl);
  const i = doc.indexOf(INICIO), f = doc.indexOf(FIM);
  const atualizado = i >= 0 && f > i ? doc.slice(0, i) + novo + doc.slice(f + FIM.length) : `${doc.trimEnd()}${nl}${nl}## Pacotes dentro do app${nl}${nl}${novo}${nl}`;
  if (process.argv.includes('--conferir')) {
    if (proibidas.length) { console.error(`Licença que não permite distribuir junto: ${proibidas.map((d) => `${d.nome}@${d.versao} (${d.licenca})`).join(', ')}`); process.exit(1); }
    if (atualizado !== doc) { console.error('LICENCAS-DE-TERCEIROS.md está desatualizado: rode node ferramentas/licencas.mjs'); process.exit(1); }
    console.log(`${deps.length} pacotes, todas as licenças permitidas, lista em dia.`);
  } else {
    if (proibidas.length) console.error(`ATENÇÃO, licença proibida: ${proibidas.map((d) => `${d.nome}@${d.versao} (${d.licenca})`).join(', ')}`);
    writeFileSync(DOC, atualizado);
    console.log(`${deps.length} pacotes escritos em LICENCAS-DE-TERCEIROS.md.`);
  }
}
