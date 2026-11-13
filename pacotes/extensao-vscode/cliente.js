// Conversa com o servidor do Gyde (sem depender do VS Code, para poder testar com Node).

class GydeError extends Error {
  constructor(message, auth = false) {
    super(message);
    this.auth = auth;
    // a IA do app ainda não foi conectada (não é erro da extensão): a tela orienta a abrir o Conectar IA no app
    this.semIA = /IA ainda não está conectada|não está configurada/i.test(message);
  }
}
// nome do modelo como o app mostra: sem o prefixo do provedor ("openai/gpt-oss-120b" vira "gpt-oss-120b")
const nomeModelo = (id) => String(id || '').split('/').pop().replace(/:free$/, '');
// "2.1.0" < "2.2.0"? Compara número a número; versão desconhecida (app de antes da 2.2, que não informa) conta como mais antiga.
function appMaisAntigo(app, extensao) {
  const partes = (v) => String(v || '').split('.').map((n) => Number.parseInt(n, 10));
  const a = partes(app), e = partes(extensao);
  if (a.some(Number.isNaN) || a.length < 2) return true;
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    const x = a[i] ?? 0, y = e[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
// O que o painel precisa saber logo ao abrir: a IA do app está conectada? O app é mais antigo que a extensão?
function avaliarStatus(status, versaoExtensao) {
  const iaPronta = Boolean(status?.keyConfigured) || (status?.iaAtiva === 'offline' && Boolean(status?.offlineDisponivel));
  const versaoApp = typeof status?.versao === 'string' ? status.versao : '';
  return { semIA: !iaPronta, versaoApp, appAntigo: appMaisAntigo(versaoApp, versaoExtensao) };
}
// Pedidos prontos para a Forja sobre um arquivo (os mesmos do cartão da Cidade, no app)
const PEDIDOS_FORJA = [
  { id: 'melhorias', rotulo: 'Sugerir melhorias', texto: (f) => `Analise o arquivo ${f} e sugira melhorias.` },
  { id: 'explicar', rotulo: 'Explicar o arquivo', texto: (f) => `Explique o arquivo ${f}: o que ele faz e como se liga ao resto do projeto.` },
  { id: 'simplificar', rotulo: 'Simplificar', texto: (f) => `Simplifique o arquivo ${f} sem mudar o que ele faz, e rode os testes.` },
  { id: 'bugs', rotulo: 'Achar bugs', texto: (f) => `Procure bugs no arquivo ${f} e corrija os que encontrar, explicando cada um.` },
  { id: 'testes', rotulo: 'Adicionar testes', texto: (f) => `Crie testes para o arquivo ${f} e rode.` },
];
const OPCOES_PADRAO = [{ id: 'gyde-1', label: 'Gyde 1', hint: '' }, { id: 'gyde-1-pro', label: 'Gyde 1 Pro', hint: '' }];

function createClient({ server, token }) {
  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(server.replace(/\/+$/, '') + path, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, 'x-gyde': '1', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch {
      throw new GydeError('Não consegui falar com o Gyde. O app do Gyde está aberto?');
    }
    if (res.status === 401) throw new GydeError('Token inválido ou revogado. Gere outro no Gyde em Configurações.', true);
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch { /* sem corpo */ }
      throw new GydeError(msg);
    }
    return res;
  }

  return {
    async me() {
      const me = await (await api('/api/auth/me')).json();
      if (!me.user) throw new GydeError('Token inválido ou revogado.', true);
      return me.user;
    },
    async newConversation() {
      return (await (await api('/api/conversations', { method: 'POST', body: '{}' })).json()).id;
    },
    async conversation(id) {
      return (await api(`/api/conversations/${id}`)).json();
    },
    // "Pedir à Forja": só deixa o pedido guardado no app. O app mostra; a pessoa abre a Forja e envia (nada roda daqui).
    async pedirForja(pasta, pedido) {
      await api('/api/forja/rascunho', { method: 'POST', body: JSON.stringify({ pasta, pedido, origem: 'vscode' }) });
    },
    // estado do app (rota liberada ao token): IA conectada e versão. Sem resposta, não avisa nada.
    async status() {
      try { return await (await api('/api/status')).json(); } catch { return null; }
    },
    // só as opções do Gyde (Gyde 1, Gyde 1 Pro): quem escolhe o modelo de verdade é o roteador do app
    async modelos() {
      try { const r = await (await api('/api/models')).json(); return r.brand?.length ? r.brand : OPCOES_PADRAO; } catch { return OPCOES_PADRAO; }
    },
    // Envia a mensagem e chama onDelta a cada pedaço da resposta. Resolve com o texto final e o modelo que respondeu.
    async send(convId, content, attachments, { onDelta, onSkills, signal, modelo } = {}) {
      const res = await api(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, attachments, mode: 'new', ...(modelo ? { model: modelo } : {}) }),
        signal,
      });
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      let respondeu = '';
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!raw.startsWith('data: ')) continue;
          const ev = JSON.parse(raw.slice(6));
          if (ev.type === 'delta') { text += ev.text; onDelta?.(text); }
          else if (ev.type === 'skills') onSkills?.(ev.skills);
          else if (ev.type === 'done') { text = ev.message.content; respondeu = nomeModelo(ev.consumo?.modelo || ev.message.model); }
          else if (ev.type === 'error') throw new GydeError(ev.error);
        }
      }
      return { text, modelo: respondeu };
    },
  };
}

module.exports = { createClient, GydeError, nomeModelo, appMaisAntigo, avaliarStatus, PEDIDOS_FORJA };
