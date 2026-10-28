// Conversa com o servidor do Gyde (sem depender do VS Code, para poder testar com Node).

class GydeError extends Error {
  constructor(message, auth = false) {
    super(message);
    this.auth = auth;
  }
}

function createClient({ server, token }) {
  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(server.replace(/\/+$/, '') + path, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, 'x-gyde': '1', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch {
      throw new GydeError('Não consegui falar com o Gyde. Ele está aberto (o app do Gyde ou o iniciar.bat)?');
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
    // Envia a mensagem e chama onDelta a cada pedaço da resposta. Resolve com o texto final.
    async send(convId, content, attachments, { onDelta, onSkills, signal } = {}) {
      const res = await api(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, attachments, mode: 'new' }),
        signal,
      });
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
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
          else if (ev.type === 'done') text = ev.message.content;
          else if (ev.type === 'error') throw new GydeError(ev.error);
        }
      }
      return text;
    },
  };
}

module.exports = { createClient, GydeError };
