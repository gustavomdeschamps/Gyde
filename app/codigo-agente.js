// Forja, o agente de código do Gyde (estilo Codex / Claude Code): você escolhe a pasta de um projeto e dá uma
// tarefa; o Gyde lê, procura, edita arquivos e roda comandos sozinho até terminar, mostrando cada passo.
// Só funciona no modo pessoal (o Gyde rodando no seu computador) e só dentro da pasta escolhida.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CADEIAS, completar, extrairJson } from './motor.js';

const MAX_PASSOS = 30; // rodadas do modelo (cada uma pode ter várias ações)
const MAX_SAIDA = 8000;
const IGNORAR = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', '.cache', 'coverage', '.idea', '.vs', 'bin', 'obj', 'target']);
const SEGREDO = /(^|[\\/])\.env(\.|$)|id_rsa|\.pem$|\.key$|credentials/i;
// Comandos que podem destruir o computador ou sair da pasta do projeto: nunca rodam.
const PERIGOSO = [
  /\bformat\s+[a-z]:/i, /\bshutdown\b/i, /\brestart-computer\b/i, /\bstop-computer\b/i, /\bdiskpart\b/i, /\bbcdedit\b/i,
  /\breg\s+(delete|add)\b/i, /\bremove-item\b[^|;&]*\s[a-z]:\\?\s*($|[|;&])/i, /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(\/|~|[a-z]:)/i,
  /\b(del|erase|rd|rmdir)\b[^|;&]*\s[a-z]:\\?\s*($|[|;&])/i, /\b(del|erase|rd|rmdir)\b[^|;&]*\\(windows|users|program files)/i,
  /\bset-executionpolicy\b/i, /\bnet\s+user\b/i, /\bcipher\s+\/w/i, /:\(\)\s*\{/,
];

const SYSTEM = `Você é a Forja, o agente de código do Gyde: um desenvolvedor de software experiente conversando com o usuário num chat
e trabalhando SOZINHO dentro da pasta de um projeto no computador dele (Windows). Você faz o trabalho de verdade: escreve código,
corrige bugs, cria e roda testes, documenta (README, comentários, docstrings) e explica o que fez. Não pede permissão no meio do caminho.

FERRAMENTAS (caminhos sempre relativos à pasta do projeto):
- listar: {"caminho": ".", "profundidade": 2} mostra pastas e arquivos
- ler: {"caminho": "src/app.js", "inicio": 1, "fim": 200} lê um arquivo com números de linha
- buscar: {"texto": "function login", "caminho": "."} procura um texto em todos os arquivos
- escrever: {"caminho": "src/novo.js", "conteudo": "..."} cria ou substitui um arquivo inteiro
- editar: {"caminho": "src/app.js", "procurar": "trecho exato atual", "substituir": "trecho novo"} troca um trecho que aparece UMA vez
- executar: {"comando": "npm test"} roda um comando no terminal (cmd do Windows) dentro da pasta, até 2 minutos

SEJA RÁPIDO: em cada passo, mande VÁRIAS ações de uma vez quando elas não dependem uma da outra
(ex.: ler 3 arquivos juntos; escrever o código e o teste juntos; editar e já rodar o teste). Menos idas e voltas = resposta mais rápida.

COMO TRABALHAR (como um bom dev):
1. Se a mensagem for só uma pergunta ou conversa, responda direto (sem ferramentas, ou lendo só o necessário).
2. Antes de mudar, entenda: leia os arquivos envolvidos. Nunca invente o conteúdo de um arquivo que você não leu.
3. Mudanças pequenas e precisas com "editar"; "escrever" para arquivos novos ou reescritas completas. Siga o estilo do projeto.
4. Verifique sempre: rode o projeto, os testes ou um comando que prove que funcionou. Se não houver teste e fizer sentido, crie um.
   Se der erro, corrija e rode de novo até passar.
5. Documente o que criar: atualize o README ou comente o código quando ajudar quem vier depois.
6. Não rode comandos que ficam esperando para sempre (servidores, watch); prefira comandos que terminam.
7. Não leia .env nem arquivos de senha/chaves e não saia da pasta do projeto.
8. A resposta final é para o usuário, em português, curta e clara, em markdown: o que fez, arquivos que mudou, resultado dos testes e como usar.
   Não use emojis; para listas e destaques use só markdown (títulos, listas, negrito, blocos de código).

RESPONDA SEMPRE com UM objeto JSON e nada mais:
- para agir: {"pensamento": "o que vou fazer (1 frase)", "acoes": [{"ferramenta": "ler", "args": {...}}, {"ferramenta": "ler", "args": {...}}]}
- para terminar ou só responder: {"pensamento": "...", "resposta": "texto em markdown"}`;

export function setupCodigoAgente(app, db, { router, asyncRoute }) {
  const pessoal = process.env.GYDE_MODE !== 'publico';
  db.exec(`
    CREATE TABLE IF NOT EXISTS agente_sessoes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pasta TEXT NOT NULL, titulo TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS agente_eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, sessao_id TEXT NOT NULL REFERENCES agente_sessoes(id) ON DELETE CASCADE, tipo TEXT NOT NULL, dados TEXT NOT NULL, created_at INTEGER NOT NULL);
  `);
  const q = {
    criar: db.prepare('INSERT INTO agente_sessoes (id, user_id, pasta, titulo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
    lista: db.prepare('SELECT id, pasta, titulo, updated_at FROM agente_sessoes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50'),
    uma: db.prepare('SELECT * FROM agente_sessoes WHERE id = ? AND user_id = ?'),
    tocar: db.prepare('UPDATE agente_sessoes SET updated_at = ?, titulo = COALESCE(?, titulo) WHERE id = ?'),
    apagar: db.prepare('DELETE FROM agente_sessoes WHERE id = ? AND user_id = ?'),
    evento: db.prepare('INSERT INTO agente_eventos (sessao_id, tipo, dados, created_at) VALUES (?, ?, ?, ?)'),
    eventos: db.prepare('SELECT tipo, dados, created_at FROM agente_eventos WHERE sessao_id = ? ORDER BY id'),
  };
  const bloqueado = (_req, res, next) => (pessoal ? next() : res.status(403).json({ error: 'A Forja só funciona com o Gyde rodando no seu computador (modo pessoal).' }));

  // ---------- validação de pastas e caminhos ----------
  function validarPasta(p) {
    const pasta = path.resolve(String(p || '').trim().replace(/^"|"$/g, ''));
    if (!pasta || !existsSync(pasta) || !statSync(pasta).isDirectory()) throw Object.assign(new Error('Pasta não encontrada. Cole o caminho completo, ex.: C:\\Users\\voce\\Documents\\meu-projeto'), { status: 400 });
    const raiz = path.parse(pasta).root;
    const proibidas = [raiz, os.homedir(), process.env.WINDIR, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'Documents'), path.join(os.homedir(), 'Downloads')]
      .filter(Boolean).map((x) => path.resolve(x).toLowerCase());
    if (proibidas.includes(pasta.toLowerCase()) || pasta.toLowerCase().startsWith((process.env.WINDIR || 'C:\\Windows').toLowerCase())) {
      throw Object.assign(new Error('Escolha a pasta de UM projeto (não o disco inteiro, a pasta do usuário, Documentos ou o Windows).'), { status: 400 });
    }
    return pasta;
  }
  const dentro = (pasta, rel) => {
    const alvo = path.resolve(pasta, String(rel || '.'));
    if (alvo !== pasta && !alvo.startsWith(pasta + path.sep)) throw new Error(`O caminho "${rel}" está fora da pasta do projeto.`);
    return alvo;
  };
  const corta = (s, n = MAX_SAIDA) => (s.length > n ? `${s.slice(0, n)}\n… (cortado, ${s.length - n} caracteres a mais)` : s);

  // ---------- ferramentas ----------
  const ferramentas = {
    listar(pasta, { caminho = '.', profundidade = 2 }) {
      const base = dentro(pasta, caminho); const linhas = []; let n = 0;
      const anda = (dir, nivel, pref) => {
        if (nivel > Math.min(Number(profundidade) || 2, 5) || n > 400) return;
        let itens; try { itens = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        itens.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
        for (const it of itens) {
          if (IGNORAR.has(it.name) || (it.name.startsWith('.') && it.name !== '.gitignore')) continue;
          n++; linhas.push(`${pref}${it.name}${it.isDirectory() ? '/' : ''}`);
          if (it.isDirectory()) anda(path.join(dir, it.name), nivel + 1, `${pref}  `);
        }
      };
      anda(base, 1, '');
      return { ok: true, saida: linhas.join('\n') || '(pasta vazia)', resumo: `${n} itens em ${caminho}` };
    },
    ler(pasta, { caminho, inicio = 1, fim }) {
      if (SEGREDO.test(caminho || '')) return { ok: false, saida: 'Arquivo de segredos: não é permitido ler.' };
      const alvo = dentro(pasta, caminho);
      if (!existsSync(alvo) || statSync(alvo).isDirectory()) return { ok: false, saida: `Arquivo não encontrado: ${caminho}` };
      if (statSync(alvo).size > 2_000_000) return { ok: false, saida: 'Arquivo grande demais para ler (mais de 2 MB).' };
      const linhas = readFileSync(alvo, 'utf8').split(/\r?\n/);
      const a = Math.max(1, Number(inicio) || 1), b = Math.min(linhas.length, Number(fim) || a + 399);
      const txt = linhas.slice(a - 1, b).map((l, i) => `${String(a + i).padStart(4)} | ${l}`).join('\n');
      return { ok: true, saida: corta(`${txt}${b < linhas.length ? `\n… (arquivo tem ${linhas.length} linhas)` : ''}`, 20000), resumo: `${caminho} (linhas ${a}–${b} de ${linhas.length})` };
    },
    buscar(pasta, { texto, caminho = '.' }) {
      if (!texto) return { ok: false, saida: 'Informe o texto a procurar.' };
      const base = dentro(pasta, caminho), achados = []; let arquivos = 0;
      const anda = (dir) => {
        if (achados.length >= 60 || arquivos > 3000) return;
        let itens; try { itens = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const it of itens) {
          if (IGNORAR.has(it.name) || it.name.startsWith('.')) continue;
          const p = path.join(dir, it.name);
          if (it.isDirectory()) { anda(p); continue; }
          if (SEGREDO.test(p)) continue;
          arquivos++;
          try { if (statSync(p).size > 1_000_000) continue; } catch { continue; }
          let conteudo; try { conteudo = readFileSync(p, 'utf8'); } catch { continue; }
          if (conteudo.includes('\u0000')) continue; // binário
          conteudo.split(/\r?\n/).forEach((l, i) => { if (achados.length < 60 && l.toLowerCase().includes(String(texto).toLowerCase())) achados.push(`${path.relative(pasta, p)}:${i + 1}: ${l.trim().slice(0, 200)}`); });
        }
      };
      anda(base);
      return { ok: true, saida: achados.join('\n') || 'Nada encontrado.', resumo: `"${texto}": ${achados.length} resultado(s)` };
    },
    escrever(pasta, { caminho, conteudo = '' }) {
      if (SEGREDO.test(caminho || '')) return { ok: false, saida: 'Não é permitido escrever em arquivos de segredos.' };
      const alvo = dentro(pasta, caminho);
      const existia = existsSync(alvo);
      mkdirSync(path.dirname(alvo), { recursive: true });
      writeFileSync(alvo, String(conteudo));
      const n = String(conteudo).split('\n').length;
      return { ok: true, saida: `${existia ? 'Arquivo substituído' : 'Arquivo criado'}: ${caminho} (${n} linhas)`, resumo: `${existia ? 'reescreveu' : 'criou'} ${caminho}`, diff: { caminho, novo: corta(String(conteudo), 4000), criado: !existia } };
    },
    editar(pasta, { caminho, procurar, substituir = '' }) {
      if (SEGREDO.test(caminho || '')) return { ok: false, saida: 'Não é permitido editar arquivos de segredos.' };
      const alvo = dentro(pasta, caminho);
      if (!existsSync(alvo)) return { ok: false, saida: `Arquivo não encontrado: ${caminho}` };
      const atual = readFileSync(alvo, 'utf8');
      const crlf = atual.includes('\r\n');
      let proc = String(procurar ?? ''); let subs = String(substituir);
      if (crlf) { proc = proc.replace(/\r?\n/g, '\r\n'); subs = subs.replace(/\r?\n/g, '\r\n'); }
      if (!proc) return { ok: false, saida: 'Informe o trecho a procurar.' };
      const vezes = atual.split(proc).length - 1;
      if (vezes === 0) return { ok: false, saida: 'O trecho a procurar não foi encontrado (precisa ser idêntico, inclusive espaços). Leia o arquivo de novo e copie o trecho exato.' };
      if (vezes > 1) return { ok: false, saida: `O trecho aparece ${vezes} vezes; inclua mais linhas em volta para ficar único.` };
      writeFileSync(alvo, atual.replace(proc, () => subs));
      return { ok: true, saida: `Editado: ${caminho}`, resumo: `editou ${caminho}`, diff: { caminho, antes: corta(String(procurar), 3000), depois: corta(String(substituir), 3000) } };
    },
    executar(pasta, { comando }, sinal) {
      const cmd = String(comando || '').trim();
      if (!cmd) return Promise.resolve({ ok: false, saida: 'Informe o comando.' });
      if (PERIGOSO.some((r) => r.test(cmd))) return Promise.resolve({ ok: false, saida: 'Comando bloqueado por segurança (pode apagar ou alterar o sistema fora do projeto).' });
      return new Promise((resolve) => {
        const p = spawn('cmd.exe', ['/d', '/s', '/c', cmd], { cwd: pasta, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0', CI: '1' } });
        let saida = '';
        const juntar = (d) => { saida += d.toString(); if (saida.length > 200_000) saida = saida.slice(-200_000); };
        p.stdout.on('data', juntar); p.stderr.on('data', juntar);
        const matar = () => { try { spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { windowsHide: true }); } catch { /* já terminou */ } };
        const limite = setTimeout(() => { saida += '\n(parado: passou de 2 minutos)'; matar(); }, 120_000);
        sinal?.addEventListener('abort', matar, { once: true });
        p.on('close', (code) => {
          clearTimeout(limite);
          const texto = saida.replace(/\x1b\[[0-9;]*m/g, '').trim();
          resolve({ ok: code === 0, saida: corta(`${texto || '(sem saída)'}\n[código de saída: ${code}]`), resumo: `${cmd} → código ${code}` });
        });
        p.on('error', (e) => { clearTimeout(limite); resolve({ ok: false, saida: e.message }); });
      });
    },
  };

  // ---------- rotas ----------
  app.get('/api/codigo/sessoes', bloqueado, (req, res) => res.json({ sessoes: q.lista.all(req.user.id), pessoal }));
  app.post('/api/codigo/sessoes', bloqueado, (req, res) => {
    const pasta = validarPasta(req.body?.pasta);
    const id = randomUUID(), t = Date.now();
    q.criar.run(id, req.user.id, pasta, path.basename(pasta), t, t);
    res.status(201).json({ id, pasta });
  });
  // Abre a janela "Selecionar pasta" do Windows (o servidor roda no mesmo computador no modo pessoal).
  let escolhendo = false;
  app.post('/api/codigo/escolher-pasta', bloqueado, asyncRoute(async (_req, res) => {
    if (process.platform !== 'win32') return res.status(400).json({ error: 'A janela de escolher pasta só existe no Windows. Cole o caminho da pasta.' });
    if (escolhendo) return res.status(409).json({ error: 'A janela de escolher pasta já está aberta.' });
    escolhendo = true;
    try {
      const script = path.join(import.meta.dirname, 'escolher-pasta.ps1');
      const pasta = await new Promise((resolve, reject) => {
        const p = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true });
        let out = '', err = '';
        p.stdout.on('data', (d) => { out += d; });
        p.stderr.on('data', (d) => { err += d; });
        p.on('error', reject);
        p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || 'Não consegui abrir a janela de pastas.'))));
      });
      res.json({ pasta: pasta || null });
    } finally { escolhendo = false; }
  }));
  app.get('/api/codigo/sessoes/:id', bloqueado, (req, res) => {
    const s = q.uma.get(req.params.id, req.user.id);
    if (!s) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.json({ ...s, eventos: q.eventos.all(s.id).map((e) => ({ tipo: e.tipo, em: e.created_at, ...JSON.parse(e.dados) })) });
  });
  app.delete('/api/codigo/sessoes/:id', bloqueado, (req, res) => { q.apagar.run(req.params.id, req.user.id); res.json({ ok: true }); });

  const rodando = new Set();
  app.post('/api/codigo/sessoes/:id/tarefa', bloqueado, asyncRoute(async (req, res) => {
    const s = q.uma.get(req.params.id, req.user.id);
    if (!s) return res.status(404).json({ error: 'Sessão não encontrada.' });
    if (rodando.has(s.id)) return res.status(409).json({ error: 'O agente já está trabalhando nesta sessão.' });
    const tarefa = String(req.body?.texto || '').trim().slice(0, 4000);
    if (!tarefa) return res.status(400).json({ error: 'Diga o que o agente deve fazer.' });
    if (!existsSync(s.pasta)) return res.status(400).json({ error: 'A pasta deste projeto não existe mais.' });

    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const controle = new AbortController();
    res.on('close', () => controle.abort());
    const registrar = (tipo, dados) => {
      q.evento.run(s.id, tipo, JSON.stringify(dados), Date.now());
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ tipo, ...dados })}\n\n`);
    };
    rodando.add(s.id);
    const inicio = Date.now();
    const mudados = new Set(); let comandos = 0, passos = 0;
    const totais = () => ({ duracao_ms: Date.now() - inicio, passos, arquivos: [...mudados], comandos });
    try {
      // memória do chat: as mensagens e respostas anteriores deste projeto
      const anteriores = q.eventos.all(s.id).filter((e) => e.tipo === 'tarefa' || e.tipo === 'resposta').slice(-12)
        .map((e) => `${e.tipo === 'tarefa' ? 'USUÁRIO' : 'VOCÊ (FORJA)'}: ${JSON.parse(e.dados).texto.slice(0, 1200)}`).join('\n\n');
      registrar('tarefa', { texto: tarefa, inicio });
      q.tocar.run(Date.now(), q.eventos.all(s.id).filter((e) => e.tipo === 'tarefa').length === 1 ? tarefa.slice(0, 60) : null, s.id);
      // contexto inicial: estrutura + arquivos que descrevem o projeto (economiza passos de leitura)
      const estrutura = ferramentas.listar(s.pasta, { caminho: '.', profundidade: 2 }).saida;
      const guias = ['package.json', 'README.md', 'requirements.txt', 'pom.xml', 'pyproject.toml'].filter((f) => existsSync(path.join(s.pasta, f)))
        .map((f) => { const r = ferramentas.ler(s.pasta, { caminho: f, inicio: 1, fim: 80 }); return r.ok ? `--- ${f} ---\n${corta(r.saida, 3500)}` : ''; }).filter(Boolean).join('\n\n');
      const msgs = [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `PASTA DO PROJETO: ${s.pasta}\nESTRUTURA:\n${corta(estrutura, 4000)}${guias ? `\n\nARQUIVOS PRINCIPAIS:\n${guias}` : ''}${anteriores ? `\n\nCONVERSA ATÉ AGORA:\n${anteriores}` : ''}\n\nNOVA MENSAGEM DO USUÁRIO: ${tarefa}` },
      ];
      const normalizar = (o) => {
        if (!o) return null;
        if (o.resposta) return o;
        const lista = Array.isArray(o.acoes) ? o.acoes : o.ferramenta ? [{ ferramenta: o.ferramenta, args: o.args }] : [];
        const acoes = lista.filter((a) => a && ferramentas[a.ferramenta]).slice(0, 8);
        return acoes.length ? { ...o, acoes } : null;
      };
      let terminou = false;
      for (let passo = 1; passo <= MAX_PASSOS && !controle.signal.aborted; passo++) {
        registrar('pensando', { passo });
        const { texto } = await completar(router, {
          cadeia: CADEIAS.agente, messages: msgs, max_tokens: 6000, temperature: 0.2, signal: controle.signal,
          valida: (t) => Boolean(normalizar(extrairJson(t))),
        });
        const o = normalizar(extrairJson(texto));
        msgs.push({ role: 'assistant', content: JSON.stringify(o) });
        if (o.resposta) { registrar('resposta', { texto: String(o.resposta), pensamento: o.pensamento || '', ...totais() }); terminou = true; break; }
        passos++;
        const resultados = [];
        for (const [i, a] of o.acoes.entries()) {
          if (controle.signal.aborted) break;
          const args = a.args && typeof a.args === 'object' ? a.args : {};
          registrar('ferramenta', { nome: a.ferramenta, args: { ...args, conteudo: args.conteudo ? `(${String(args.conteudo).split('\n').length} linhas)` : undefined }, pensamento: i === 0 ? o.pensamento || '' : '' });
          let r;
          try { r = await ferramentas[a.ferramenta](s.pasta, args, controle.signal); } catch (err) { r = { ok: false, saida: err.message }; }
          if (r.ok && (a.ferramenta === 'escrever' || a.ferramenta === 'editar')) mudados.add(String(args.caminho));
          if (a.ferramenta === 'executar') comandos++;
          registrar('resultado', { nome: a.ferramenta, ok: r.ok, resumo: r.resumo || '', saida: corta(r.saida, 3000), diff: r.diff });
          resultados.push(`RESULTADO ${i + 1} — ${a.ferramenta} ${JSON.stringify(args.caminho || args.comando || args.texto || '')} (${r.ok ? 'ok' : 'falhou'}):\n${r.saida}`);
        }
        msgs.push({ role: 'user', content: resultados.join('\n\n') });
        // mantém a conversa num tamanho seguro: resume resultados antigos
        if (msgs.length > 30) for (let i = 2; i < msgs.length - 12; i++) if (msgs[i].role === 'user' && msgs[i].content.length > 800) msgs[i].content = `${msgs[i].content.slice(0, 800)}\n… (resultado antigo resumido)`;
      }
      if (!terminou && !controle.signal.aborted) registrar('resposta', { texto: `Parei depois de ${MAX_PASSOS} rodadas. Mande "continue" para eu seguir de onde parei.`, ...totais() });
    } catch (err) {
      if (err.name !== 'AbortError') registrar('erro', { texto: err.message, ...totais() });
    } finally {
      rodando.delete(s.id);
      if (controle.signal.aborted) q.evento.run(s.id, 'erro', JSON.stringify({ texto: 'Parado por você.', ...totais() }), Date.now());
      q.tocar.run(Date.now(), null, s.id);
      if (!res.writableEnded) { res.write(`data: ${JSON.stringify({ tipo: 'fim' })}\n\n`); res.end(); }
    }
  }));
}
