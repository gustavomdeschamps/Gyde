// "Ao vivo" da Forja: liga o projeto da pasta conectada, como um terminal que a pessoa autoriza.
// - Projetos web: descobre o comando (dev, start, preview, serve) e o framework pelo package.json e afins, liga o
//   servidor do próprio projeto só em 127.0.0.1 numa porta livre, espera ele responder e mostra a página no painel.
// - Pasta de build pronta (dist/, build/, out/) ou site de HTML puro: serve com um servidor estático de verdade,
//   com a raiz certa (caminhos "/assets/..." funcionam).
// - Outros projetos (Python, Java, C#, Go, Rust, bibliotecas): roda o comando e mostra a saída ao vivo.
// Segurança: nada roda sem a pessoa clicar vendo o comando exato; comandos bloqueados pela Forja continuam bloqueados;
// o projeto recebe um ambiente sem as chaves do Gyde; a saída passa pelo mesmo filtro de segredos da Forja.
// Limpeza: Parar, fechar o painel, ficar sem notícia do painel ou fechar o Gyde encerram tudo que o Ao vivo ligou.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer, request, type Server } from 'node:http';
import { createServer as criarRede } from 'node:net';
import { existsSync, readdirSync, readFileSync, statSync, createReadStream, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ARQUIVO_SECRETO, ambienteLimpo, classificarComando, redigir } from './seguranca.ts';
import { problemaDaPagina } from './previa.ts';

export type TipoOpcao = 'web' | 'estatico' | 'console';
export interface OpcaoAoVivo {
  id: string; rotulo: string; detalhe: string; tipo: TipoOpcao;
  pasta: string; // relativa à pasta do projeto ('' = raiz)
  comando: string | null; // com {porta} no lugar da porta; null no estático
  instalar: string | null; // comando para instalar dependências, se faltarem
  ferramenta: string | null; // programa que precisa existir no computador (node, python, java...)
  env?: Record<string, string>; // variáveis para o projeto usar a porta e o endereço certos
}
export interface PlanoAoVivo { opcoes: OpcaoAoVivo[]; recomendada: string | null; motivo: string | null }
export type FaseAoVivo = 'parado' | 'instalando' | 'iniciando' | 'pronto' | 'rodando' | 'terminou' | 'falhou';
export interface EstadoAoVivo {
  fase: FaseAoVivo; opcao: string | null; comando: string | null; url: string | null; porta: number | null;
  tipo: TipoOpcao | null; saida: string[]; mensagem: string | null; erroParaForja: string | null; desde: number | null;
  total: number; // linhas de saída desde o começo (o painel pede só as novas)
  primeira: number; // número da primeira linha de "saida" nesta resposta
}

const PULAR = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', 'coverage', '__pycache__', '.venv', 'venv', 'target', 'obj', 'bin', '.cache', 'vendor']);
const SAIDAS_BUILD = ['dist', 'build', 'out', '_site', 'public'];
const lerJson = (arq: string) => { try { return JSON.parse(readFileSync(arq, 'utf8')) as Record<string, unknown>; } catch { return null; } };
const tem = (pasta: string, ...nomes: string[]) => nomes.some((n) => existsSync(path.join(pasta, n)));
const lerTexto = (arq: string) => { try { return readFileSync(arq, 'utf8').slice(0, 100_000); } catch { return ''; } };

// gerenciador de pacotes pelo arquivo de trava (na pasta do pacote ou na raiz do repositório)
function gerenciador(pastaPkg: string, raiz: string) {
  for (const p of [pastaPkg, raiz]) {
    if (tem(p, 'pnpm-lock.yaml', 'pnpm-workspace.yaml')) return 'pnpm';
    if (tem(p, 'yarn.lock')) return 'yarn';
    if (tem(p, 'bun.lockb', 'bun.lock')) return 'bun';
    if (tem(p, 'package-lock.json')) return 'npm';
  }
  return 'npm';
}
const rodarScript = (pm: string, script: string, args: string) => {
  if (!args) return `${pm} run ${script}`;
  return pm === 'npm' ? `npm run ${script} -- ${args}` : `${pm} run ${script} ${args}`;
};

// O que cada framework precisa para ouvir só em 127.0.0.1 e na porta escolhida.
function argsDoFramework(script: string, deps: Record<string, unknown>): { nome: string; args: string; env?: Record<string, string> } {
  const s = script.toLowerCase();
  if (/\bnext\b/.test(s)) return { nome: 'Next.js', args: '-H 127.0.0.1 -p {porta}' };
  if (/\bnuxi?\b|\bnuxt\b/.test(s)) return { nome: 'Nuxt', args: '--host 127.0.0.1 --port {porta}' };
  if (/\bastro\b/.test(s)) return { nome: 'Astro', args: '--host 127.0.0.1 --port {porta}' };
  if (/\bng\b/.test(s)) return { nome: 'Angular', args: '--host 127.0.0.1 --port {porta}' };
  if (/vue-cli-service/.test(s)) return { nome: 'Vue CLI', args: '--host 127.0.0.1 --port {porta}' };
  if (/react-scripts/.test(s)) return { nome: 'Create React App', args: '', env: { BROWSER: 'none' } };
  if (/\bvite\b/.test(s)) {
    const sabor = deps.react ? 'React' : deps.vue ? 'Vue' : deps.svelte ? 'Svelte' : deps['solid-js'] ? 'Solid' : '';
    return { nome: sabor ? `Vite (${sabor})` : 'Vite', args: '--host 127.0.0.1 --port {porta} --strictPort' };
  }
  if (/\bwebpack(-dev-server)?\b.*serve|webpack serve/.test(s)) return { nome: 'Webpack', args: '--host 127.0.0.1 --port {porta}' };
  return { nome: '', args: '' };
}

function opcoesNode(raiz: string, rel: string, ids: Set<string>): OpcaoAoVivo[] {
  const dir = path.join(raiz, rel);
  const pkg = lerJson(path.join(dir, 'package.json'));
  if (!pkg) return [];
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const deps = { ...(pkg.dependencies as object ?? {}), ...(pkg.devDependencies as object ?? {}) } as Record<string, unknown>;
  const nome = ['dev', 'start', 'preview', 'serve'].find((n) => typeof scripts[n] === 'string');
  if (!nome) return [];
  const pm = gerenciador(dir, raiz);
  const fw = argsDoFramework(scripts[nome]!, deps);
  const semDeps = !existsSync(path.join(dir, 'node_modules')) && !existsSync(path.join(raiz, 'node_modules'));
  const onde = rel || 'raiz do projeto';
  const id = `node:${rel || '.'}`;
  if (ids.has(id)) return [];
  ids.add(id);
  return [{
    id, tipo: 'web', pasta: rel, ferramenta: pm,
    rotulo: fw.nome ? `${fw.nome} · ${onde}` : `Script "${nome}" · ${onde}`,
    detalhe: `Liga o servidor de desenvolvimento do projeto (script "${nome}": ${scripts[nome]}).`,
    comando: rodarScript(pm, nome, fw.args),
    instalar: semDeps ? `${pm} install` : null,
    env: { PORT: '{porta}', HOST: '127.0.0.1', ...(fw.env ?? {}) },
  }];
}

function opcoesPython(raiz: string): OpcaoAoVivo[] {
  const req = (lerTexto(path.join(raiz, 'requirements.txt')) + lerTexto(path.join(raiz, 'pyproject.toml'))).toLowerCase();
  const pys = (() => { try { return readdirSync(raiz).filter((f) => f.endsWith('.py')); } catch { return []; } })();
  if (!pys.length && !req) return [];
  const instalar = existsSync(path.join(raiz, 'requirements.txt')) ? 'python -m pip install -r requirements.txt' : null;
  const base = { pasta: '', ferramenta: 'python', instalar };
  if (pys.includes('manage.py')) return [{ ...base, id: 'py:django', tipo: 'web', rotulo: 'Django · raiz do projeto', detalhe: 'Liga o servidor do Django.', comando: 'python manage.py runserver 127.0.0.1:{porta}' }];
  const principal = ['app.py', 'main.py', 'server.py', 'run.py', 'wsgi.py'].find((f) => pys.includes(f)) ?? pys.find((f) => /if\s+__name__\s*==/.test(lerTexto(path.join(raiz, f)))) ?? pys[0];
  if (!principal) return [];
  const codigo = lerTexto(path.join(raiz, principal));
  const modulo = principal.replace(/\.py$/, '');
  if (/streamlit/.test(req) || /import streamlit/.test(codigo)) return [{ ...base, id: 'py:streamlit', tipo: 'web', rotulo: `Streamlit · ${principal}`, detalhe: 'Liga o app do Streamlit.', comando: `python -m streamlit run ${principal} --server.address 127.0.0.1 --server.port {porta} --server.headless true` }];
  if (/fastapi/.test(req) || /from fastapi|import fastapi/.test(codigo)) return [{ ...base, id: 'py:fastapi', tipo: 'web', rotulo: `FastAPI · ${principal}`, detalhe: 'Liga a API com o uvicorn.', comando: `python -m uvicorn ${modulo}:app --host 127.0.0.1 --port {porta}` }];
  if (/flask/.test(req) || /from flask|import flask/.test(codigo)) return [{ ...base, id: 'py:flask', tipo: 'web', rotulo: `Flask · ${principal}`, detalhe: 'Liga o servidor do Flask.', comando: `python -m flask --app ${modulo} run --host 127.0.0.1 --port {porta}` }];
  return [{ ...base, id: 'py:script', tipo: 'console', rotulo: `Python · ${principal}`, detalhe: `Roda ${principal} e mostra a saída.`, comando: `python ${principal}`, instalar }];
}

function opcoesOutras(raiz: string): OpcaoAoVivo[] {
  const r: OpcaoAoVivo[] = [];
  const arquivos = (() => { try { return readdirSync(raiz); } catch { return []; } })();
  if (arquivos.includes('pom.xml')) {
    const spring = /spring-boot/.test(lerTexto(path.join(raiz, 'pom.xml')));
    r.push({ id: 'java:maven', tipo: spring ? 'web' : 'console', pasta: '', ferramenta: 'mvn', instalar: null, rotulo: spring ? 'Spring Boot (Maven)' : 'Java (Maven)',
      detalhe: spring ? 'Liga a aplicação Spring Boot.' : 'Compila e roda com o Maven.', comando: spring ? 'mvn -q spring-boot:run' : 'mvn -q compile exec:java',
      env: spring ? { SERVER_PORT: '{porta}', SERVER_ADDRESS: '127.0.0.1' } : {} });
  } else if (arquivos.some((f) => /^build\.gradle(\.kts)?$/.test(f))) {
    const spring = /spring-boot|org\.springframework\.boot/.test(lerTexto(path.join(raiz, arquivos.find((f) => f.startsWith('build.gradle'))!)));
    const gradle = arquivos.includes('gradlew.bat') ? 'gradlew.bat' : 'gradle';
    r.push({ id: 'java:gradle', tipo: spring ? 'web' : 'console', pasta: '', ferramenta: gradle === 'gradle' ? 'gradle' : null, instalar: null, rotulo: spring ? 'Spring Boot (Gradle)' : 'Java/Kotlin (Gradle)',
      detalhe: 'Roda com o Gradle.', comando: `${gradle} ${spring ? 'bootRun' : 'run'}`, env: spring ? { SERVER_PORT: '{porta}', SERVER_ADDRESS: '127.0.0.1' } : {} });
  } else {
    const java = arquivos.find((f) => f.endsWith('.java') && /public\s+static\s+void\s+main/.test(lerTexto(path.join(raiz, f))));
    if (java) r.push({ id: 'java:arquivo', tipo: 'console', pasta: '', ferramenta: 'java', instalar: null, rotulo: `Java · ${java}`, detalhe: `Roda ${java} direto (Java 11 ou mais novo).`, comando: `java ${java}` });
  }
  const csproj = arquivos.find((f) => f.endsWith('.csproj'));
  if (csproj) {
    const web = /Microsoft\.NET\.Sdk\.Web/.test(lerTexto(path.join(raiz, csproj)));
    r.push({ id: 'dotnet', tipo: web ? 'web' : 'console', pasta: '', ferramenta: 'dotnet', instalar: null, rotulo: `${web ? 'ASP.NET' : 'C#'} · ${csproj}`, detalhe: 'Roda com o dotnet.', comando: 'dotnet run', env: web ? { ASPNETCORE_URLS: 'http://127.0.0.1:{porta}' } : {} });
  }
  if (arquivos.includes('go.mod')) r.push({ id: 'go', tipo: 'console', pasta: '', ferramenta: 'go', instalar: null, rotulo: 'Go', detalhe: 'Roda com go run (se for servidor, a página aparece quando ele responder).', comando: 'go run .', env: { PORT: '{porta}' } });
  if (arquivos.includes('Cargo.toml')) r.push({ id: 'rust', tipo: 'console', pasta: '', ferramenta: 'cargo', instalar: null, rotulo: 'Rust', detalhe: 'Compila e roda com o cargo.', comando: 'cargo run', env: { PORT: '{porta}' } });
  return r;
}

// sites prontos: pasta de build com index.html, ou HTML puro que abre sem compilar
function opcoesEstaticas(raiz: string, relsPkg: string[]): OpcaoAoVivo[] {
  const r: OpcaoAoVivo[] = [];
  for (const rel of ['', ...relsPkg.filter(Boolean)]) {
    for (const saida of SAIDAS_BUILD) {
      const dir = rel ? `${rel}/${saida}` : saida;
      if (saida === 'public' && relsPkg.length) continue; // public/ de projeto com package.json é fonte, não build
      if (existsSync(path.join(raiz, dir, 'index.html')) && !problemaDaPagina(raiz, `${dir}/index.html`)?.startsWith('carrega') ) {
        r.push({ id: `estatico:${dir}`, tipo: 'estatico', pasta: dir, comando: null, instalar: null, ferramenta: null,
          rotulo: `Site pronto em ${dir}/`, detalhe: `Serve os arquivos de ${dir}/ como estão (o resultado do último build).` });
      }
    }
  }
  if (existsSync(path.join(raiz, 'index.html')) && !problemaDaPagina(raiz, 'index.html')?.match(/compilado|não existe|pacotes pelo nome/)) {
    r.push({ id: 'estatico:.', tipo: 'estatico', pasta: '', comando: null, instalar: null, ferramenta: null, rotulo: 'Site de HTML, CSS e JavaScript', detalhe: 'Serve os arquivos do projeto como estão.' });
  }
  return r;
}

export function planejarAoVivo(raiz: string): PlanoAoVivo {
  const ids = new Set<string>();
  const opcoes: OpcaoAoVivo[] = [];
  // Node na raiz e em subpastas (monorepos), até 3 níveis
  const relsPkg: string[] = [];
  const anda = (rel: string, nivel: number) => {
    if (existsSync(path.join(raiz, rel, 'package.json'))) relsPkg.push(rel);
    if (nivel >= 3 || relsPkg.length > 40) return;
    let itens;
    try { itens = readdirSync(path.join(raiz, rel), { withFileTypes: true }); } catch { return; }
    for (const it of itens) if (it.isDirectory() && !it.isSymbolicLink() && !PULAR.has(it.name) && !it.name.startsWith('.')) anda(rel ? `${rel}/${it.name}` : it.name, nivel + 1);
  };
  anda('', 0);
  for (const rel of relsPkg) opcoes.push(...opcoesNode(raiz, rel, ids));
  opcoes.push(...opcoesEstaticas(raiz, relsPkg), ...opcoesPython(raiz), ...opcoesOutras(raiz));
  // recomendada: servidor web da raiz que já tem as dependências; senão o site pronto; senão o primeiro web; senão o resto
  const nota = (o: OpcaoAoVivo) => (o.tipo === 'web' && !o.pasta && !o.instalar ? 0 : o.tipo === 'estatico' ? 1 : o.tipo === 'web' && !o.pasta ? 2 : o.tipo === 'web' ? 3 : 4);
  const recomendada = [...opcoes].sort((a, b) => nota(a) - nota(b))[0]?.id ?? null;
  return {
    opcoes, recomendada,
    motivo: opcoes.length ? null : 'Não achei nada para ligar nesta pasta: nenhum package.json com dev/start, nenhum site pronto (index.html), nenhum projeto Python, Java, C#, Go ou Rust. Se o projeto roda com outro comando, escreva o comando em "Outro comando".',
  };
}

// ---------- quando algo falha: o motivo real, em português, e o que fazer ----------
const FALTA: Record<string, string> = {
  npm: 'O Node.js não está instalado (ou não está no PATH). Instale a versão LTS em nodejs.org e abra o Gyde de novo.',
  node: 'O Node.js não está instalado (ou não está no PATH). Instale a versão LTS em nodejs.org e abra o Gyde de novo.',
  pnpm: 'Este projeto usa o pnpm, que não está instalado. Instale com "npm install -g pnpm" (ou "corepack enable") e tente de novo.',
  yarn: 'Este projeto usa o Yarn, que não está instalado. Instale com "npm install -g yarn" (ou "corepack enable") e tente de novo.',
  bun: 'Este projeto usa o Bun, que não está instalado. Instale pelo site bun.sh e tente de novo.',
  python: 'O Python não está instalado (ou só existe o atalho da Microsoft Store). Instale em python.org, marcando "Add python.exe to PATH", e tente de novo.',
  java: 'O Java não está instalado. Instale um JDK (por exemplo o Temurin, em adoptium.net) e tente de novo.',
  mvn: 'O Maven não está instalado. Instale em maven.apache.org (ou use o mvnw do projeto) e tente de novo.',
  gradle: 'O Gradle não está instalado. Instale em gradle.org (ou use o gradlew do projeto) e tente de novo.',
  dotnet: 'O .NET não está instalado. Instale o SDK em dotnet.microsoft.com e tente de novo.',
  go: 'O Go não está instalado. Instale em go.dev e tente de novo.',
  cargo: 'O Rust não está instalado. Instale pelo rustup.rs e tente de novo.',
};
export function explicarErro(saida: string, codigo: number | null, opcao: Pick<OpcaoAoVivo, 'instalar' | 'ferramenta'> | null): string {
  const t = saida.slice(-20_000);
  let m: RegExpMatchArray | null;
  if (/Python (was not found|não foi encontrado)|Microsoft Store/i.test(t)) return FALTA.python!;
  if ((m = t.match(/'([\w.-]+)' não é reconhecido como um comando interno|'([\w.-]+)' is not recognized as an internal or external command/i))) {
    const prog = (m[1] ?? m[2] ?? '').toLowerCase();
    if (FALTA[prog]) return FALTA[prog]!;
    return `O programa "${prog}" não foi encontrado. ${opcao?.instalar ? `Normalmente ele vem com as dependências do projeto: use "Instalar e iniciar" (roda ${opcao.instalar}).` : 'Instale-o ou confira o comando.'}`;
  }
  if (/EADDRINUSE|address already in use|port \d+ is (already )?in use|Port \d+ is in use/i.test(t)) return 'A porta já está ocupada por outro programa. Clique em Reiniciar: o Gyde escolhe outra porta livre. Se continuar, feche o outro servidor (por exemplo outro terminal com npm run dev).';
  if ((m = t.match(/ModuleNotFoundError: No module named '([^']+)'/))) return `Falta o pacote Python "${m[1]}". ${opcao?.instalar ? `Use "Instalar e iniciar" (roda ${opcao.instalar}).` : `Instale com: python -m pip install ${m[1]}`}`;
  if (/Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|command not found|Cannot find package/i.test(t)) return `Falta uma dependência do projeto. ${opcao?.instalar ? `Use "Instalar e iniciar" (roda ${opcao.instalar}).` : 'Instale as dependências do projeto (por exemplo npm install) e tente de novo.'}`;
  if (/npm ERR!|ERR_PNPM|error An unexpected error/i.test(t) && /install/i.test(t)) return 'A instalação das dependências falhou. Veja a saída abaixo; muitas vezes é internet, versão do Node ou um pacote quebrado. Você pode pedir à Forja para consertar.';
  if (/error TS\d+|SyntaxError|ReferenceError|TypeError|Failed to compile|Build failed|\[vite\].*error|Compilation failed|Traceback \(most recent call last\)|Exception in thread|BUILD FAILURE|error CS\d+/i.test(t)) return 'O projeto tem um erro no código (aparece na saída abaixo). Peça à Forja para consertar: o erro já vai copiado.';
  if (codigo != null && codigo !== 0) return `O comando parou com erro (código ${codigo}). Veja as últimas linhas da saída abaixo.`;
  return 'O comando terminou.';
}

// ---------- execução ----------
interface Execucao {
  estado: EstadoAoVivo; opcaoInfo: OpcaoAoVivo | null; pastaProjeto: string;
  proc: ChildProcess | null; estatico: Server | null; contato: number; geracao: number;
  pendente: string; lote: ReturnType<typeof setTimeout> | null; // saída ainda não processada (vai em lotes de 120 ms)
}
const portaLivre = () => new Promise<number>((ok, falha) => { const s = criarRede(); s.on('error', falha); s.listen(0, '127.0.0.1', () => { const p = (s.address() as { port: number }).port; s.close(() => ok(p)); }); });
// eslint-disable-next-line no-control-regex -- tira as cores do terminal (ESC[...m) e outros códigos
const semAnsi = (t: string) => t.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r(?!\n)/g, '\n');
const URL_LOCAL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::(\d{2,5}))?/i;
const vazio = (): EstadoAoVivo => ({ fase: 'parado', opcao: null, comando: null, url: null, porta: null, tipo: null, saida: [], mensagem: null, erroParaForja: null, desde: null, total: 0, primeira: 0 });
const TIPOS: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.map': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

// servidor estático de verdade: raiz = pasta do site; "/assets/x" funciona; página de app (SPA) cai no index.html
function servirEstatico(raiz: string, porta: number): Promise<Server> {
  const raizReal = realpathSync.native(raiz);
  const s = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]!.split('#')[0]!);
    let alvo = path.resolve(raizReal, `.${url}`);
    if (alvo !== raizReal && !alvo.startsWith(raizReal + path.sep)) { res.writeHead(403).end('Fora do site.'); return; }
    if (ARQUIVO_SECRETO.test(path.relative(raizReal, alvo))) { res.writeHead(404).end('Arquivo não encontrado.'); return; }
    try { if (statSync(alvo).isDirectory()) alvo = path.join(alvo, 'index.html'); } catch { /* não existe */ }
    if (!existsSync(alvo) && !path.extname(alvo)) alvo = path.join(raizReal, 'index.html'); // rota de app de página única
    if (!existsSync(alvo)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Arquivo não encontrado.'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    createReadStream(alvo).pipe(res);
  });
  return new Promise((ok, falha) => { s.on('error', falha); s.listen(porta, '127.0.0.1', () => ok(s)); });
}

// o servidor do projeto já responde? (qualquer resposta HTTP serve: até um 404 quer dizer que ele está de pé)
const responde = (porta: number) => new Promise<boolean>((ok) => {
  const r = request({ host: '127.0.0.1', port: porta, path: '/', method: 'GET', timeout: 1500 }, (res) => { res.resume(); ok(true); });
  r.on('error', () => ok(false)); r.on('timeout', () => { r.destroy(); ok(false); }); r.end();
});

// Parar de verdade: espera o taskkill e a saída do processo (no máximo 5 s), para "Parar" só responder com ele morto.
function matarEsperando(p: ChildProcess | null): Promise<void> {
  if (!p?.pid || p.exitCode !== null) return Promise.resolve();
  return new Promise((ok) => {
    const fim = setTimeout(ok, 5000);
    p.once('exit', () => { clearTimeout(fim); ok(); });
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { windowsHide: true }).on('error', () => {});
    else { try { process.kill(-p.pid!, 'SIGTERM'); } catch { p.kill('SIGTERM'); } }
  });
}
function matarArvore(p: ChildProcess | null, sync = false) {
  if (!p?.pid || p.exitCode !== null) return;
  if (process.platform === 'win32') {
    const args = ['/pid', String(p.pid), '/t', '/f'];
    if (sync) spawnSync('taskkill', args, { windowsHide: true }); else spawn('taskkill', args, { windowsHide: true });
  } else { try { process.kill(-p.pid, 'SIGTERM'); } catch { p.kill('SIGTERM'); } }
}

// Processos ligados pelo Ao vivo ficam anotados num arquivo (número do processo e comando). Se o Gyde for fechado à força,
// na próxima abertura ele encerra os que ainda estiverem rodando, conferindo antes que a linha de comando bate
// (para não matar outro programa que tenha ganhado o mesmo número de processo).
type Anotado = { pid: number; comando: string };
const lerAnotados = (arq: string): Anotado[] => { try { const v = JSON.parse(readFileSync(arq, 'utf8')) as unknown; return Array.isArray(v) ? v.filter((x): x is Anotado => typeof x?.pid === 'number' && typeof x?.comando === 'string') : []; } catch { return []; } };
export async function encerrarOrfaos(arq: string): Promise<number> {
  const anotados = lerAnotados(arq);
  if (!anotados.length) return 0;
  let encerrados = 0;
  for (const a of anotados) {
    if (process.platform !== 'win32') { try { process.kill(-a.pid, 'SIGTERM'); encerrados++; } catch { /* já tinha saído */ } continue; }
    const linha = await new Promise<string>((ok) => {
      const p = spawn('powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${a.pid}").CommandLine`], { windowsHide: true });
      let out = ''; p.stdout.on('data', (d: Buffer) => { out += d.toString(); }); p.on('close', () => ok(out.trim())); p.on('error', () => ok(''));
    });
    if (linha && linha.includes(a.comando)) { spawnSync('taskkill', ['/pid', String(a.pid), '/t', '/f'], { windowsHide: true }); encerrados++; }
  }
  try { writeFileSync(arq, '[]'); } catch { /* sem como gravar */ }
  return encerrados;
}

export function criarAoVivo({ contatoMaximo = 45_000, arquivoPids = '' }: { contatoMaximo?: number; arquivoPids?: string } = {}) {
  const execucoes = new Map<string, Execucao>();
  const anotar_ = (lista: Anotado[]) => { if (arquivoPids) { try { writeFileSync(arquivoPids, JSON.stringify(lista)); } catch { /* sem como gravar */ } } };
  const anotarPid = (pid: number | undefined, comando: string) => { if (pid && arquivoPids) anotar_([...lerAnotados(arquivoPids).filter((a) => a.pid !== pid), { pid, comando }]); };
  const esquecerPid = (pid: number | undefined) => { if (pid && arquivoPids) anotar_(lerAnotados(arquivoPids).filter((a) => a.pid !== pid)); };
  const pegar = (sessao: string, pasta: string) => {
    let e = execucoes.get(sessao);
    if (!e) { e = { estado: vazio(), opcaoInfo: null, pastaProjeto: pasta, proc: null, estatico: null, contato: Date.now(), geracao: 0, pendente: '', lote: null }; execucoes.set(sessao, e); }
    e.pastaProjeto = pasta;
    return e;
  };
  // A saída do projeto chega aos pedaços (às vezes milhares de linhas por segundo): junta em lotes de 120 ms e só então
  // tira cores e segredos e separa as linhas. Assim um servidor tagarela não ocupa o Gyde a cada pedacinho.
  const processar = (e: Execucao) => {
    if (e.lote) { clearTimeout(e.lote); e.lote = null; }
    if (!e.pendente) return;
    const texto = e.pendente; e.pendente = '';
    const linhas = redigir(semAnsi(texto)).split(/\r?\n/).filter((l, i, a) => l.trim() || i < a.length - 1);
    e.estado.saida.push(...linhas.map((l) => l.slice(0, 2000)));
    e.estado.total += linhas.length;
    if (e.estado.saida.length > 600) e.estado.saida.splice(0, e.estado.saida.length - 600);
  };
  const anotar = (e: Execucao, texto: string, agora = false) => {
    e.pendente += texto;
    if (e.pendente.length > 256_000) e.pendente = e.pendente.slice(-256_000);
    if (agora) processar(e); else e.lote ??= setTimeout(() => processar(e), 120);
  };
  const falhar = (e: Execucao, codigo: number | null) => {
    processar(e);
    const texto = e.estado.saida.join('\n');
    e.estado.fase = 'falhou';
    e.estado.mensagem = explicarErro(texto, codigo, e.opcaoInfo);
    e.estado.erroParaForja = [
      'O "Ao vivo" do Gyde não conseguiu ligar o projeto. Descubra a causa e conserte, para o projeto ligar.',
      `Comando: ${e.estado.comando ?? '(nenhum)'}`, `Pasta: ${e.opcaoInfo?.pasta || 'raiz do projeto'}`, `O Gyde entendeu: ${e.estado.mensagem}`,
      'Últimas linhas da saída:', '```', ...e.estado.saida.slice(-40), '```',
    ].join('\n');
  };

  // roda um comando (instalação ou o projeto); devolve o processo
  function rodar(e: Execucao, comando: string, cwd: string, env: Record<string, string>) {
    anotar(e, `> ${comando}\n`, true);
    const p = spawn(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/d', '/s', '/c', `"${comando}"`] : ['-c', comando],
      { cwd, windowsHide: true, windowsVerbatimArguments: true, detached: process.platform !== 'win32', env: ambienteLimpo({ FORCE_COLOR: '0', NO_COLOR: '1', ...env }) });
    p.stdout?.on('data', (d: Buffer) => anotar(e, d.toString()));
    p.stderr?.on('data', (d: Buffer) => anotar(e, d.toString()));
    anotarPid(p.pid, comando);
    p.on('close', () => esquecerPid(p.pid));
    e.proc = p;
    return p;
  }

  async function parar(sessao: string) {
    const e = execucoes.get(sessao);
    if (!e) return vazio();
    e.geracao++;
    const proc = e.proc; e.proc = null;
    await matarEsperando(proc);
    if (e.estatico) { e.estatico.close(); e.estatico.closeAllConnections?.(); e.estatico = null; }
    if (e.estado.fase !== 'parado') { anotar(e, '(parado)\n'); e.estado.fase = 'parado'; e.estado.url = null; e.estado.mensagem = null; e.estado.erroParaForja = null; }
    return e.estado;
  }

  async function iniciar(sessao: string, pasta: string, opcaoId: string | null, { instalar = false, comandoProprio = '' }: { instalar?: boolean; comandoProprio?: string } = {}): Promise<EstadoAoVivo> {
    await parar(sessao);
    const e = pegar(sessao, pasta);
    const geracao = ++e.geracao;
    const plano = planejarAoVivo(pasta);
    let opcao: OpcaoAoVivo | undefined;
    if (comandoProprio.trim()) {
      const cmd = comandoProprio.trim().slice(0, 500);
      const risco = classificarComando(cmd);
      if (risco.nivel === 'bloqueado') throw Object.assign(new Error(`Comando bloqueado pela segurança do Gyde: ${risco.motivo}.`), { status: 400 });
      opcao = { id: 'proprio', tipo: 'web', pasta: '', comando: cmd, instalar: null, ferramenta: null, rotulo: 'Outro comando', detalhe: '', env: { PORT: '{porta}', HOST: '127.0.0.1' } };
    } else opcao = plano.opcoes.find((o) => o.id === opcaoId);
    if (!opcao) throw Object.assign(new Error('Essa forma de ligar o projeto não existe mais. Recarregue o painel.'), { status: 400 });
    const cwd = path.resolve(pasta, opcao.pasta);
    if (cwd !== pasta && !cwd.startsWith(pasta + path.sep)) throw Object.assign(new Error('Pasta fora do projeto.'), { status: 400 });
    e.opcaoInfo = opcao;
    e.contato = Date.now();
    e.pendente = '';
    e.estado = { ...vazio(), opcao: opcao.id, tipo: opcao.tipo, desde: Date.now(), fase: 'iniciando', total: e.estado.total, primeira: e.estado.total };
    const porta = await portaLivre();
    const trocar = (t: string) => t.replaceAll('{porta}', String(porta));

    if (opcao.tipo === 'estatico') {
      try { e.estatico = await servirEstatico(cwd, porta); } catch (err) { anotar(e, String(err)); falhar(e, null); return e.estado; }
      Object.assign(e.estado, { fase: 'pronto', porta, url: `http://localhost:${porta}/`, comando: `servidor estático do Gyde em ${opcao.pasta || 'raiz do projeto'}/` });
      anotar(e, `Servindo ${opcao.pasta || 'a raiz do projeto'} em http://localhost:${porta}/ (só neste computador)\n`);
      return e.estado;
    }
    // falta o programa? (antes de rodar, para a mensagem ser clara)
    if (opcao.ferramenta && process.platform === 'win32' && spawnSync('where', [opcao.ferramenta], { windowsHide: true }).status !== 0) {
      e.estado.comando = trocar(opcao.comando!);
      anotar(e, `"${opcao.ferramenta}" não foi encontrado neste computador.\n`);
      e.estado.fase = 'falhou'; e.estado.mensagem = FALTA[opcao.ferramenta] ?? `O programa "${opcao.ferramenta}" não está instalado.`;
      e.estado.erroParaForja = null; // não é código para a Forja consertar: é programa para instalar
      return e.estado;
    }
    const env = Object.fromEntries(Object.entries(opcao.env ?? {}).map(([k, v]) => [k, trocar(v)]));
    const ligar = () => {
      if (geracao !== e.geracao) return;
      e.estado.fase = 'iniciando';
      e.estado.comando = trocar(opcao.comando!);
      const p = rodar(e, e.estado.comando, cwd, env);
      let portaVista: number | null = opcao.tipo === 'web' ? porta : null;
      const olhar = (d: Buffer) => { const m = semAnsi(d.toString()).match(URL_LOCAL); if (m?.[1]) portaVista = Number(m[1]); };
      p.stdout?.on('data', olhar); p.stderr?.on('data', olhar);
      // espera o servidor responder (web: na porta pedida ou na que ele anunciar); console: só mostra a saída
      const inicio = Date.now();
      const espiar = async () => {
        if (geracao !== e.geracao || p.exitCode !== null) return;
        if (portaVista && await responde(portaVista)) {
          if (geracao !== e.geracao) return;
          Object.assign(e.estado, { fase: 'pronto', porta: portaVista, url: `http://localhost:${portaVista}/` });
          return;
        }
        const passou = Date.now() - inicio;
        // console: mostra a saída logo; web: depois de alguns segundos sem página, mostra a saída também (e segue vigiando)
        if (e.estado.fase === 'iniciando' && (opcao.tipo !== 'web' ? passou > 1500 : passou > 8000)) e.estado.fase = 'rodando';
        if (opcao.tipo === 'web' && passou > 120_000) { e.estado.mensagem = 'O comando está rodando, mas não achei uma página dele depois de 2 minutos. Veja a saída: talvez ele não seja um site, ou use outra porta.'; return; }
        setTimeout(espiar, 700);
      };
      setTimeout(espiar, 600);
      p.on('close', (codigo) => {
        if (geracao !== e.geracao) return;
        e.proc = null;
        anotar(e, `[o comando terminou com código ${codigo ?? '?'}]\n`);
        if (codigo === 0 && opcao.tipo === 'console') { e.estado.fase = 'terminou'; e.estado.mensagem = 'O programa terminou sem erros.'; e.estado.url = null; return; }
        falhar(e, codigo);
        e.estado.url = null;
      });
    };
    if (instalar && opcao.instalar) {
      e.estado.fase = 'instalando';
      e.estado.comando = opcao.instalar;
      const p = rodar(e, opcao.instalar, cwd, {});
      p.on('close', (codigo) => {
        if (geracao !== e.geracao) return;
        e.proc = null;
        if (codigo !== 0) { anotar(e, `[a instalação terminou com código ${codigo}]\n`); falhar(e, codigo); return; }
        anotar(e, '[dependências instaladas]\n');
        ligar();
      });
    } else ligar();
    return e.estado;
  }

  // o painel pergunta o estado de tempos em tempos; sem notícia dele, o que estiver ligado é parado (nada fica escondido)
  const vigia = setInterval(() => {
    for (const [sessao, e] of execucoes) if ((e.proc || e.estatico) && Date.now() - e.contato > contatoMaximo) { void parar(sessao); }
  }, 5000);
  vigia.unref();

  // fechar o Gyde: encerra tudo na hora (síncrono, para dar tempo antes de o processo sair)
  function encerrarTudo() {
    for (const e of execucoes.values()) { e.geracao++; matarArvore(e.proc, true); esquecerPid(e.proc?.pid); e.proc = null; e.estatico?.close(); e.estatico = null; }
  }

  return {
    planejar: planejarAoVivo,
    iniciar, parar, encerrarTudo,
    // desde: o painel já tem as linhas até este número; volta só as novas (ou todas, se ele ficou para trás)
    estado(sessao: string, desde = -1) {
      const e = execucoes.get(sessao);
      if (!e) return vazio();
      e.contato = Date.now();
      processar(e);
      const base = e.estado.total - e.estado.saida.length; // número da primeira linha guardada
      const de = desde >= base ? desde : base;
      return { ...e.estado, saida: e.estado.saida.slice(de - base), primeira: de };
    },
    ativos: () => [...execucoes.values()].filter((e) => e.proc || e.estatico).length,
    fechar() { clearInterval(vigia); encerrarTudo(); },
  };
}
export type AoVivo = ReturnType<typeof criarAoVivo>;
