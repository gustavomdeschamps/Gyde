// Gyde para VS Code: chat na barra lateral + comandos para explicar, revisar e entender erros.
const vscode = require('vscode');
const { createClient } = require('./cliente.js');

const TOKEN_KEY = 'gyde.token';
const MAX_CODE = 60_000;

function activate(context) {
  const view = new ChatView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gyde.chat', view, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('gyde.abrir', () => view.reveal()),
    vscode.commands.registerCommand('gyde.novaConversa', () => view.newConversation()),
    vscode.commands.registerCommand('gyde.configurar', () => view.askToken()),
    vscode.commands.registerCommand('gyde.desconectar', async () => {
      await context.secrets.delete(TOKEN_KEY);
      view.post({ type: 'state', connected: false });
      vscode.window.showInformationMessage('Gyde desconectado deste VS Code.');
    }),
    vscode.commands.registerCommand('gyde.explicar', () => {
      const ctx = codeContext(true);
      if (ctx) view.ask('Explique este trecho de código de forma simples, linha por linha quando ajudar.', ctx);
    }),
    vscode.commands.registerCommand('gyde.revisar', () => {
      const ctx = codeContext(false);
      if (ctx) view.ask('/revisar Revise este código: aponte bugs, más práticas e como melhorar, explicando o porquê.', ctx);
    }),
    vscode.commands.registerCommand('gyde.explicarErro', () => {
      const ctx = errorContext();
      if (ctx) view.ask('Meu código deu este erro. Explique o que significa e como corrigir, passo a passo.', ctx);
    }),
  );
}

// Seleção (ou o arquivo inteiro) do editor ativo, como anexo.
function codeContext(selectionOnly) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage('Abra um arquivo no editor primeiro.'); return null; }
  const doc = editor.document;
  const sel = editor.selection;
  const hasSel = !sel.isEmpty;
  if (selectionOnly && !hasSel) { vscode.window.showWarningMessage('Selecione um trecho de código primeiro.'); return null; }
  const text = (hasSel ? doc.getText(sel) : doc.getText()).slice(0, MAX_CODE);
  const file = vscode.workspace.asRelativePath(doc.uri);
  const where = hasSel ? `${file} (linhas ${sel.start.line + 1}–${sel.end.line + 1})` : file;
  return { label: where, attachment: { kind: 'file', name: where, text: `Linguagem: ${doc.languageId}\n\n${text}` } };
}

// Erros e avisos da linha do cursor, com o código em volta.
function errorContext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage('Abra um arquivo no editor primeiro.'); return null; }
  const doc = editor.document;
  const line = editor.selection.active.line;
  const all = vscode.languages.getDiagnostics(doc.uri);
  const near = all.filter((d) => d.range.start.line <= line && d.range.end.line >= line);
  const diags = near.length ? near : all.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).slice(0, 3);
  if (!diags.length) {
    vscode.window.showInformationMessage('Não há erro marcado nesta linha. Se o erro apareceu no terminal, copie a mensagem e cole no chat do Gyde.');
    return null;
  }
  const first = Math.max(0, diags[0].range.start.line - 12);
  const last = Math.min(doc.lineCount - 1, diags[0].range.end.line + 12);
  const code = [];
  for (let i = first; i <= last; i++) code.push(`${String(i + 1).padStart(4)} | ${doc.lineAt(i).text}`);
  const file = vscode.workspace.asRelativePath(doc.uri);
  const errs = diags.map((d) => `Linha ${d.range.start.line + 1}: ${d.message}${d.source ? ` (${d.source})` : ''}`).join('\n');
  return {
    label: `Erro em ${file}:${diags[0].range.start.line + 1}`,
    attachment: { kind: 'file', name: `Erro em ${file}`, text: `Linguagem: ${doc.languageId}\n\nErros:\n${errs}\n\nCódigo (linhas ${first + 1}–${last + 1}):\n${code.join('\n')}` },
  };
}

class ChatView {
  constructor(context) {
    this.context = context;
    this.view = null;
    this.busy = false;
    this.queue = null; // pedido feito antes de o painel abrir
    this.abort = null;
  }

  get convId() { return this.context.workspaceState.get('gyde.convId') || null; }
  set convId(v) { this.context.workspaceState.update('gyde.convId', v); }

  async client() {
    const token = await this.context.secrets.get(TOKEN_KEY);
    if (!token) return null;
    return createClient({ server: vscode.workspace.getConfiguration('gyde').get('servidor'), token });
  }

  post(msg) { this.view?.webview.postMessage(msg); }

  reveal() { vscode.commands.executeCommand('gyde.chat.focus'); }

  resolveWebviewView(view) {
    this.view = view;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const uri = (f) => view.webview.asWebviewUri(vscode.Uri.joinPath(media, f));
    const nonce = [...Array(24)].map(() => Math.random().toString(36)[2]).join('');
    view.webview.html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${view.webview.cspSource} data:; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="${uri('painel.css')}"></head>
      <body><div id="app"></div><script type="module" nonce="${nonce}" src="${uri('painel.js')}"></script></body></html>`;
    view.webview.onDidReceiveMessage((m) => this.onMessage(m));
    view.onDidDispose(() => { this.view = null; });
  }

  async onMessage(m) {
    if (m.type === 'ready') {
      const client = await this.client();
      if (!client) return this.post({ type: 'state', connected: false });
      try {
        const user = await client.me();
        this.post({ type: 'state', connected: true, userName: user.name.split(' ')[0] });
        await this.restore(client);
      } catch (e) {
        this.post({ type: 'state', connected: false, error: e.message });
      }
      if (this.queue) { const q = this.queue; this.queue = null; this.ask(q.text, q.ctx); }
    } else if (m.type === 'send') {
      this.ask(m.text, null);
    } else if (m.type === 'connect') {
      this.askToken();
    } else if (m.type === 'new') {
      this.newConversation();
    } else if (m.type === 'stop') {
      this.abort?.abort();
    } else if (m.type === 'insert') {
      const editor = vscode.window.activeTextEditor || vscode.window.visibleTextEditors[0];
      if (!editor) return vscode.window.showWarningMessage('Abra um arquivo para inserir o código.');
      await editor.edit((e) => e.replace(editor.selection, m.code));
      vscode.window.showTextDocument(editor.document, editor.viewColumn);
    } else if (m.type === 'copy') {
      await vscode.env.clipboard.writeText(m.code);
      vscode.window.setStatusBarMessage('Código copiado', 2000);
    } else if (m.type === 'cmd' && ['gyde.explicar', 'gyde.revisar', 'gyde.explicarErro', 'gyde.novaConversa'].includes(m.id)) {
      vscode.commands.executeCommand(m.id); // cartões de ação do painel
    } else if (m.type === 'openWeb') {
      const server = vscode.workspace.getConfiguration('gyde').get('servidor');
      vscode.env.openExternal(vscode.Uri.parse(`${server}/#/c/${this.convId || ''}`));
    }
  }

  async restore(client) {
    if (!this.convId) return;
    try {
      const conv = await client.conversation(this.convId);
      this.post({ type: 'history', title: conv.title, messages: conv.messages.map((x) => ({ role: x.role, content: x.content, tags: (x.attachments || []).map((a) => a.name) })) });
    } catch {
      this.convId = null; // apagada no site
    }
  }

  async askToken() {
    const token = await vscode.window.showInputBox({
      title: 'Conectar ao Gyde',
      prompt: 'No Gyde: Personalizar → Extensões → Gerar token. Cole o token aqui (o mesmo serve para o VS Code).',
      password: true,
      ignoreFocusOut: true,
      validateInput: (v) => (/^gyde_[0-9a-f]{48}$/.test(v.trim()) ? null : 'O token começa com gyde_ e tem 53 caracteres.'),
    });
    if (!token) return;
    const client = createClient({ server: vscode.workspace.getConfiguration('gyde').get('servidor'), token: token.trim() });
    try {
      const user = await client.me();
      await this.context.secrets.store(TOKEN_KEY, token.trim());
      this.post({ type: 'state', connected: true, userName: user.name.split(' ')[0] });
      vscode.window.showInformationMessage(`Gyde conectado. Oi, ${user.name.split(' ')[0]}!`);
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
    }
  }

  newConversation() {
    this.abort?.abort();
    this.convId = null;
    this.post({ type: 'clear' });
  }

  async ask(text, ctx) {
    if (!this.view) { this.queue = { text, ctx }; this.reveal(); return; }
    this.reveal();
    if (this.busy) return vscode.window.showInformationMessage('Espere o Gyde terminar a resposta atual.');
    const client = await this.client();
    if (!client) { this.post({ type: 'state', connected: false }); return this.askToken(); }
    this.busy = true;
    this.abort = new AbortController();
    this.post({ type: 'user', text, tags: ctx ? [ctx.label] : [] });
    try {
      if (!this.convId) this.convId = await client.newConversation();
      const answer = await client.send(this.convId, text, ctx ? [ctx.attachment] : [], {
        signal: this.abort.signal,
        onDelta: (t) => this.post({ type: 'delta', text: t }),
        onSkills: (skills) => this.post({ type: 'skills', skills: skills.map((s) => `${s.simbolo} ${s.nome}`) }),
      });
      this.post({ type: 'done', text: answer });
    } catch (e) {
      if (e.name === 'AbortError') this.post({ type: 'done', stopped: true });
      else {
        this.post({ type: 'error', message: e.message });
        if (e.auth) this.post({ type: 'state', connected: false, error: e.message });
      }
    }
    this.busy = false;
    this.abort = null;
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
