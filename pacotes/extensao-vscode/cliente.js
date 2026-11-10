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

module.exports = { createClient, GydeError, nomeModelo };
