<script lang="ts">
  // Configurações do Gyde: cada controle salva na hora. Preferências da conta vão para o servidor (contrato
  // Preferencias); tema e vídeo de abertura são deste navegador.
  import { untrack } from 'svelte';
  import * as C from '$contratos';
  import type { TMemoria, TTokens, TPlano } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';
  import { temaSalvo, definirTema, type Tema } from '../tema.ts';
  import { uso, atualizarUso, nomeModelo, NOME_PROVEDOR } from './uso.svelte.ts';
  import UsoAba from './UsoAba.svelte';
  import { desktop } from '../desktop.ts';
  import { montarRelatorio } from '../diagnostico.ts';

  type Aba = 'geral' | 'ia' | 'uso' | 'pratica' | 'dados' | 'extensoes';
  let { toast, copiar, verAbertura, refazerQuiz, restaurarModelo, recarregarConversas }: {
    toast: (t: string) => void; copiar: (texto: string, botao: HTMLElement) => void; verAbertura: () => void;
    refazerQuiz: () => void; restaurarModelo: () => void; recarregarConversas: () => Promise<void>;
  } = $props();

  const ABAS: [Aba, string][] = [['geral', 'Geral'], ['ia', 'IA e modelos'], ['uso', 'Uso e limites'], ['pratica', 'Prática'], ['dados', 'Privacidade e dados'], ['extensoes', 'Extensões']];
  let dialogo: HTMLDialogElement | undefined = $state();
  let aba = $state<Aba>('geral');
  let tema = $state<Tema>(temaSalvo());
  let pref = $state({ about_user: '', response_style: '', pagina_inicial: 'chat' as C.TPreferencias['pagina_inicial'] });
  let memoria = $state<TMemoria | null>(null);
  let novaMemoria = $state('');
  let tokens = $state<TTokens['tokens']>([]);
  let tokenNovo = $state('');
  let plano = $state<{ carregando: boolean; erro: string; dados: TPlano | null }>({ carregando: false, erro: '', dados: null });
  // no modo público (servidor de uma turma) chaves, modo da IA e cópia ficam com quem cuida do servidor
  let pessoal = $state(true);
  let chave = $state({ configurada: null as boolean | null, texto: '', salvando: false });
  let imagens = $state({ ligadas: null as boolean | null, conta: '', token: '', salvando: false });

  export async function abrir(qual: Aba = 'geral') {
    aba = qual; tema = temaSalvo(); tokenNovo = '';
    try { pref = await pedir('/api/settings', C.Preferencias); } catch (e) { toast(mensagemDe(e)); }
    carregarMemoria(); carregarTokens(); carregarChave();
    if (!dialogo?.open) dialogo?.showModal();
  }
  // ao trocar de aba, busca os dados dela (untrack: o carregamento escreve estado e não pode reativar o efeito)
  $effect(() => { const a = aba; untrack(() => { if (a === 'uso' || a === 'ia') atualizarUso(); if (a === 'ia') carregarChave(); if (a === 'pratica') carregarPlano(); }); });

  const salvar = async (dados: Partial<C.TPreferencias>) => {
    try { pref = await pedir('/api/settings', C.Preferencias, { method: 'PUT', body: JSON.stringify(dados) }); toast('Salvo'); } catch (e) { toast(mensagemDe(e)); }
  };
  async function restaurar() {
    if (!confirm('Voltar o tema, a página inicial e o modelo do chat ao padrão?')) return;
    tema = 'auto'; definirTema('auto'); restaurarModelo();
    await salvar({ pagina_inicial: 'chat' });
  }

  async function carregarMemoria() { try { memoria = await pedir('/api/memoria', C.Memoria); } catch { memoria = null; } }
  async function memoriaPedido(url: string, init: RequestInit) { try { memoria = await pedir(url, C.Memoria, init); return true; } catch (e) { toast(mensagemDe(e)); return false; } }
  async function guardarMemoria() { if (novaMemoria.trim() && await memoriaPedido('/api/memoria', corpo({ texto: novaMemoria }))) novaMemoria = ''; }
  async function apagarMemoria() { if (confirm('Apagar tudo o que o Gyde lembra sobre você?') && await memoriaPedido('/api/memoria', { method: 'DELETE' })) toast('Memória apagada'); }
  const ORIGEM_MEM: Record<string, string> = { auto: 'aprendido', manual: 'você escreveu', pedido: 'você pediu' };

  async function carregarTokens() { try { tokens = (await pedir('/api/tokens', C.Tokens)).tokens; } catch { tokens = []; } }
  async function gerarToken() {
    try { const r = await pedir('/api/tokens', C.TokenNovo, corpo({ name: 'Extensão do Gyde' })); tokenNovo = r.token; tokens = r.tokens; } catch (e) { toast(mensagemDe(e)); }
  }
  async function revogar(id: string) {
    if (!confirm('Revogar este token? A extensão que usa ele vai parar de funcionar.')) return;
    try { tokens = (await pedir(`/api/tokens/${id}`, C.Tokens, { method: 'DELETE' })).tokens; toast('Token revogado'); } catch (e) { toast(mensagemDe(e)); }
  }
  const data = (t: number | null) => (t ? new Date(t).toLocaleDateString('pt-BR') : 'nunca');

  async function carregarPlano() {
    plano = { carregando: true, erro: '', dados: plano.dados };
    try { plano = { carregando: false, erro: '', dados: (await pedir('/api/pratica', C.EstadoPratica)).plano }; }
    catch (e) { console.error('[Gyde] Configurações > Prática:', e); plano = { carregando: false, erro: mensagemDe(e), dados: null }; }
  }

  async function carregarChave() {
    try { const s = await pedir('/api/status', C.Status); chave.configurada = s.keyConfigured; imagens.ligadas = s.imagesEnabled; pessoal = s.pessoal; } catch { chave.configurada = null; imagens.ligadas = null; }
  }
  // a chave vai direto para o .env deste computador; a tela nunca recebe ela de volta
  async function salvarChave(e: SubmitEvent) {
    e.preventDefault();
    chave.salvando = true;
    try {
      await enviar('/api/config/chave-freellmapi', { method: 'PUT', body: JSON.stringify({ chave: chave.texto }) });
      chave.texto = ''; chave.configurada = true;
      toast('Chave salva neste computador');
      atualizarUso();
      dispatchEvent(new Event('gyde:status')); // a faixa de aviso do topo confere de novo
    } catch (err) { toast(mensagemDe(err)); }
    chave.salvando = false;
  }

  // imagens (Cloudflare): o servidor confere conta e token antes de gravar; o token nunca volta para a tela
  async function salvarImagens(e: SubmitEvent) {
    e.preventDefault();
    imagens.salvando = true;
    try {
      await enviar('/api/config/imagens', { method: 'PUT', body: JSON.stringify({ conta: imagens.conta, token: imagens.token }) });
      imagens.ligadas = true; imagens.conta = ''; imagens.token = '';
      toast('Imagens ligadas: use o botão Imagem no chat');
      dispatchEvent(new Event('gyde:status'));
    } catch (err) { toast(mensagemDe(err)); }
    imagens.salvando = false;
  }
  async function desligarImagens() {
    if (!confirm('Desligar a geração de imagens? A conta e o token da Cloudflare saem deste computador.')) return;
    try { await enviar('/api/config/imagens', { method: 'DELETE' }); imagens.ligadas = false; toast('Imagens desligadas'); dispatchEvent(new Event('gyde:status')); } catch (err) { toast(mensagemDe(err)); }
  }

  async function mudarModo(modo: string) {
    try { await enviar('/api/uso/modo', corpo({ modo })); toast('Modo da IA alterado'); } catch (e) { toast(mensagemDe(e)); }
    atualizarUso();
  }

  const APAGAR = {
    conversas: { pergunta: 'Apagar TODAS as conversas do chat? Não dá para desfazer.', rota: '/api/conversations', depois: async (r: { apagadas: number }) => { toast(`${r.apagadas} conversa(s) apagada(s)`); await recarregarConversas(); if (location.hash.startsWith('#/c/')) location.hash = '#/'; } },
    forja: { pergunta: 'Apagar todas as conversas da Forja? Os arquivos dos projetos não são tocados.', rota: '/api/codigo/sessoes', depois: async (r: { apagadas: number }) => toast(`${r.apagadas} conversa(s) da Forja apagada(s)`) },
    uso: { pergunta: 'Zerar o registro de uso desta conta?', rota: '/api/uso', depois: async () => { toast('Registro de uso apagado'); atualizarUso(); } },
  };
  // cópia de segurança: restaurar só vale quando o Gyde reabre (o servidor troca o banco antes de abrir)
  let restaurada = $state<C.TRestauracaoPreparada | null>(null);
  let restaurando = $state(false);
  async function restaurarCopia(e: Event) {
    const campo = e.currentTarget as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;
    if (!confirm('Restaurar esta cópia? Todos os dados deste Gyde (contas, conversas, progresso) serão trocados pelos da cópia quando ele reabrir. Os dados atuais ficam guardados em copias-banco.')) return;
    restaurando = true;
    try { restaurada = await pedir('/api/dados/restaurar', C.RestauracaoPreparada, { method: 'POST', body: arquivo }); } catch (err) { toast(mensagemDe(err)); }
    restaurando = false;
  }

  async function apagar(qual: keyof typeof APAGAR) {
    const a = APAGAR[qual];
    if (!confirm(a.pergunta)) return;
    try { await a.depois(await enviar<{ apagadas: number }>(a.rota, { method: 'DELETE' })); } catch (e) { toast(mensagemDe(e)); }
  }

  function teclaAbas(e: KeyboardEvent) { // setas trocam de aba (padrão de abas acessíveis)
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const i = ABAS.findIndex(([id]) => id === aba);
    aba = ABAS[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length]![0];
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-aba="${aba}"]`)?.focus();
  }
  const fechar = () => dialogo?.close();
</script>

<dialog bind:this={dialogo} id="settingsDialog" class="dialog config" aria-labelledby="configTitulo" onclose={() => { tokenNovo = ''; }}>
  <div class="config-form">
    <header class="config-topo">
      <h2 id="configTitulo">Configurações</h2>
      <button type="button" class="icon-btn" aria-label="Fechar" onclick={fechar}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    <div class="config-corpo">
      <div class="config-abas" role="tablist" aria-label="Seções das configurações" tabindex="-1" onkeydown={teclaAbas}>
        {#each ABAS as [id, rotulo]}
          <button type="button" role="tab" data-aba={id} aria-selected={aba === id} tabindex={aba === id ? 0 : -1} onclick={() => (aba = id)}>{rotulo}</button>
        {/each}
      </div>

      {#if aba === 'geral'}
        <section class="config-painel" role="tabpanel" data-painel="geral">
          <div class="config-linha">
            <div><b>Tema</b><small>Automático segue o tema do Windows. Fica salvo neste navegador.</small></div>
            <select bind:value={tema} onchange={() => definirTema(tema)} aria-label="Tema"><option value="auto">Automático</option><option value="light">Claro</option><option value="dark">Escuro</option></select>
          </div>
          <div class="config-linha">
            <div><b>Ao abrir o Gyde</b><small>Página que aparece quando você entra. Fica salvo na sua conta.</small></div>
            <select bind:value={pref.pagina_inicial} onchange={() => salvar({ pagina_inicial: pref.pagina_inicial })} aria-label="Página inicial"><option value="chat">Conversas</option><option value="pratica">Prática</option><option value="agente">Forja</option></select>
          </div>
          <div class="config-linha">
            <div><b>Vídeo de abertura</b><small>Aparece só na primeira vez em cada navegador.</small></div>
            <button type="button" class="btn ghost" id="replayIntro" onclick={() => { fechar(); verAbertura(); }}>Ver de novo</button>
          </div>
          <div class="config-linha">
            <div><b>Restaurar padrões</b><small>Volta o tema, a página inicial e o modelo do chat ao padrão. Não apaga conversas nem progresso.</small></div>
            <button type="button" class="btn ghost" onclick={restaurar}>Restaurar</button>
          </div>
          <div class="config-linha">
            <div><b>Relatório de erro</b><small>Copia um resumo técnico (versões, estado da IA e erros recentes, sem conversas nem chaves) para você colar numa issue. Nada é enviado sozinho.</small></div>
            <button type="button" class="btn ghost" onclick={async (e) => { const botao = e.currentTarget; copiar(await montarRelatorio(), botao); }}>Copiar relatório</button>
          </div>
        </section>
      {:else if aba === 'ia'}
        <section class="config-painel" role="tabpanel" data-painel="ia">
          {#if uso.dados}
            {@const d = uso.dados}
            {#if !pessoal}
              <p class="config-nota">Neste Gyde, a chave da IA, o modo (online ou offline) e as imagens são configurados por quem cuida do servidor.</p>
            {:else}
            <div class="config-linha">
              <div><b>Modo da IA</b><small>Vale para o Gyde inteiro neste computador.</small></div>
              <select value={d.modo} onchange={(e) => mudarModo((e.currentTarget as HTMLSelectElement).value)} aria-label="Modo da IA">
                <option value="auto">Automático (online; local se cair)</option>
                <option value="online">Só online (FreeLLMAPI)</option>
                <option value="offline" disabled={!d.offline.disponivel}>Só offline ({d.offline.modelo}){d.offline.disponivel ? '' : ' · indisponível'}</option>
              </select>
            </div>
            <form class="config-linha config-chave" onsubmit={salvarChave}>
              <div><b>Chave do FreeLLMAPI</b><small>{chave.configurada ? 'Configurada neste computador. Para trocar, cole a nova.' : 'No ícone do FreeLLMAPI na bandeja, clique em "Copy Key" e cole aqui.'}</small></div>
              <span class="config-chave-campo">
                <input type="password" autocomplete="off" spellcheck="false" placeholder={chave.configurada ? '••••••••' : 'freellmapi-…'} aria-label="Chave do FreeLLMAPI" bind:value={chave.texto}>
                <button class="btn small primary" disabled={!chave.texto.trim() || chave.salvando}>Salvar</button>
              </span>
            </form>
            {#if imagens.ligadas}
              <div class="config-linha"><div><b>Gerar imagens</b><small>Ligado (Cloudflare Workers AI, cota diária grátis). Use o botão Imagem no chat.</small></div>
                <button type="button" class="btn small ghost" onclick={desligarImagens}>Desligar</button></div>
            {:else if imagens.ligadas === false}
              <form class="config-linha config-chave" onsubmit={salvarImagens}>
                <div><b>Gerar imagens (opcional)</b><small>Grátis com uma conta da <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">Cloudflare</a>: copie o Account ID (menu da conta) e crie um API Token com o modelo "Workers AI".</small></div>
                <span class="config-chave-campo config-imagens-campos">
                  <input type="text" autocomplete="off" spellcheck="false" placeholder="Account ID" aria-label="Account ID da Cloudflare" bind:value={imagens.conta}>
                  <input type="password" autocomplete="off" spellcheck="false" placeholder="API Token" aria-label="API Token da Cloudflare" bind:value={imagens.token}>
                  <button class="btn small primary" disabled={!imagens.conta.trim() || !imagens.token.trim() || imagens.salvando}>{imagens.salvando ? 'Conferindo…' : 'Ligar'}</button>
                </span>
              </form>
            {/if}
            {/if}
            <dl class="config-dl">
              <div><dt>Em uso agora</dt><dd><b>{NOME_PROVEDOR[d.ativo]}</b></dd></div>
              <div><dt>FreeLLMAPI</dt><dd>{#if d.online.disponivel}<span class="ok">conectado</span>{:else}<span class="ruim">sem resposta ou sem chave</span>{/if}</dd></div>
              <div><dt>Modelo local</dt><dd>{#if d.offline.disponivel}<span class="ok">{d.offline.modelo} pronto</span>{:else}<span class="ruim">indisponível</span>{d.offline.instalados.length ? ` (instalados: ${d.offline.instalados.join(', ')})` : ' (Ollama fechado ou sem modelo)'}{/if}</dd></div>
              <div><dt>Última resposta</dt><dd>{uso.ultima ? `${nomeModelo(uso.ultima.modelo) || 'modelo não informado'} via ${NOME_PROVEDOR[uso.ultima.provedor] ?? ''}` : 'nenhuma nesta sessão'}</dd></div>
            </dl>
            {#if d.modo === 'auto'}<p class="config-nota">No automático, se o FreeLLMAPI parar de responder, o Gyde usa o modelo local e avisa na resposta. Ele é mais simples e mais lento, e nada sai do computador.</p>{/if}
          {:else}
            <p class="msg-error">{uso.erro ? 'Não consegui falar com o servidor do Gyde.' : 'Carregando…'}</p>
          {/if}
          <label>O que o Gyde deve saber sobre você?
            <textarea rows="3" maxlength="4000" bind:value={pref.about_user} onchange={() => salvar({ about_user: pref.about_user })} placeholder="Ex.: Estou no 1º ano do técnico em informática, sei um pouco de Python e quero aprender Java."></textarea></label>
          <label>Como você quer as respostas?
            <textarea rows="3" maxlength="4000" bind:value={pref.response_style} onchange={() => salvar({ response_style: pref.response_style })} placeholder="Ex.: Respostas curtas e diretas, com exemplos de código comentados."></textarea></label>
          <p class="config-nota">Os textos são salvos quando você sai do campo. O modelo de cada conversa é escolhido no topo do chat.</p>
          <div class="profile-box memory-box" class:off={memoria && !memoria.ativa}>
            <div class="memory-head">
              <p><b>Memória</b><br>O Gyde lembra fatos sobre você entre conversas (projetos, objetivos, dificuldades). Diga "lembre que…" para guardar algo.</p>
              <label class="switch"><input type="checkbox" aria-label="Memória ligada" checked={memoria?.ativa ?? false} onchange={(e) => memoriaPedido('/api/memoria/config', { method: 'PUT', body: JSON.stringify({ ativa: (e.currentTarget as HTMLInputElement).checked }) })}><span></span></label>
            </div>
            <ul class="memory-list">
              {#each memoria?.itens ?? [] as it, i (it.id)}
                <li style="animation-delay:{i * 30}ms"><span>{it.text}</span><small>{ORIGEM_MEM[it.source]}</small><button type="button" aria-label="Esquecer" onclick={() => memoriaPedido(`/api/memoria/${it.id}`, { method: 'DELETE' })}>×</button></li>
              {:else}<li class="empty"><span>Ainda não lembro de nada sobre você.</span></li>{/each}
            </ul>
            <div class="memory-add"><input maxlength="200" bind:value={novaMemoria} placeholder="Ex.: estou fazendo um jogo em Pygame para o TCC" aria-label="Novo fato para a memória" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarMemoria(); } }}><button type="button" class="btn small" onclick={guardarMemoria}>Guardar</button></div>
            <button type="button" class="link" onclick={apagarMemoria}>Apagar toda a memória</button>
          </div>
        </section>
      {:else if aba === 'uso'}
        <section class="config-painel" role="tabpanel" data-painel="uso"><UsoAba /></section>
      {:else if aba === 'pratica'}
        <section class="config-painel" role="tabpanel" data-painel="pratica">
          {#if plano.erro}
            <div class="config-erro" role="alert"><p>{plano.erro}</p><button type="button" class="btn small" onclick={carregarPlano}>Tentar de novo</button></div>
          {:else if !plano.dados}
            <div class="skeleton" style="height:90px"></div>
          {:else}
            {@const p = plano.dados}
            <p class="config-nota"><b>Plano atual:</b> {p.explicacao} Tecnologias: {p.tecnologias.join(', ')}; nível {p.nivel}.</p>
            {#if p.declarado && p.medido}
              <h3 class="config-sub">O que você respondeu <small>em {p.declarado.em ? new Date(p.declarado.em).toLocaleDateString('pt-BR') : 'data não registrada'}</small></h3>
              <dl class="config-dl">
                <div><dt>Experiência</dt><dd>{p.declarado.experiencia || 'não respondeu'}</dd></div>
                <div><dt>Linguagens</dt><dd>{p.declarado.linguagens.join(', ') || 'nenhuma escolhida'}</dd></div>
                <div><dt>Objetivo</dt><dd>{p.declarado.objetivo || 'não respondeu'}</dd></div>
                <div><dt>Como aprende melhor</dt><dd>{p.declarado.estilo || 'não respondeu'}</dd></div>
              </dl>
              <h3 class="config-sub">O que o mini desafio mediu</h3>
              <dl class="config-dl">
                <div><dt>Nível estimado</dt><dd>{p.medido.nivel} ({p.medido.acertos} de {p.medido.total})</dd></div>
                <div><dt>Para reforçar</dt><dd>{p.medido.reforcar.join(', ') || 'nada: acertou tudo'}</dd></div>
                {#if p.medido.anteriores.length}<div><dt>Antes</dt><dd>{p.medido.anteriores.map((a) => `${a.nivel} (${a.acertos}/${a.total}) em ${a.em ? new Date(a.em).toLocaleDateString('pt-BR') : '?'}`).join(' · ')}</dd></div>{/if}
              </dl>
              <h3 class="config-sub">O que os exercícios mostram</h3>
              <dl class="config-dl">
                <div><dt>Exercícios feitos</dt><dd>{p.observado.feitos}</dd></div>
                <div><dt>Tentativas com erro</dt><dd>{p.observado.tentativasComErro}</dd></div>
                <div><dt>Ainda travado em</dt><dd>{p.observado.travados.length ? `${p.observado.travados.length} exercício(s)` : 'nenhum'}</dd></div>
              </dl>
            {:else}
              <p class="config-nota">Você ainda não respondeu o questionário. Sem ele, a Prática começa pelo mais simples (lógica e Python). Leva uns 3 minutos e muda as recomendações e o jeito do Gyde explicar.</p>
            {/if}
          {/if}
          <div class="config-botoes">
            <button type="button" class="btn primary" id="redoQuiz" onclick={() => { fechar(); refazerQuiz(); }}>{plano.dados?.temQuiz ? 'Refazer o questionário' : 'Fazer o questionário'}</button>
            <a class="btn ghost" href="#/pratica" onclick={fechar}>Abrir a Prática</a>
          </div>
          <p class="config-nota">Refazer o questionário atualiza as recomendações. Exercícios feitos, XP e sequência continuam.</p>
        </section>
      {:else if aba === 'dados'}
        <section class="config-painel" role="tabpanel" data-painel="dados">
          <div class="config-texto">
            <p><b>Onde ficam seus dados.</b> Conversas, progresso, memória{#if pessoal}, registro de uso e conversas da Forja{:else} e registro de uso{/if} ficam {#if !pessoal}no servidor deste Gyde{:else}no banco deste computador ({#if desktop}<code>%APPDATA%\Gyde\dados</code>{:else}pasta <code>data</code> do Gyde{/if}){/if}. Cada conta só vê os próprios dados.</p>
            <p><b>O que sai {#if pessoal}do computador{:else}do servidor{/if}.</b> No modo online, o texto das mensagens{#if pessoal}, os anexos e os trechos de arquivos que a Forja lê{:else} e os anexos{/if} vão para o FreeLLMAPI, que repassa a um serviço de IA (Groq, Google, Mistral e outros, conforme as chaves configuradas nele). No modo offline nada sai: o modelo roda no Ollama, aqui mesmo.</p>
            <p><b>O que nunca vai para a IA.</b> Arquivos <code>.env</code>, chaves SSH, certificados e outros arquivos de senhas são bloqueados. Chaves e tokens encontrados em textos são trocados por <code>[segredo removido]</code>.</p>
          </div>
          {#if pessoal}
          <div class="config-linha"><div><b>Baixar cópia de segurança</b><small>Um .zip com tudo deste Gyde: contas (senhas só como hash), conversas, progresso, memória e imagens. Guarde em lugar seguro.</small></div><a class="btn ghost" href="/api/dados/copia" download>Baixar</a></div>
          <div class="config-linha"><div><b>Restaurar cópia</b><small>Troca os dados deste Gyde pelos de uma cópia (.zip). Vale quando o Gyde reabre.</small></div>
            <label class="btn ghost" class:desligado={restaurando}>{restaurando ? 'Conferindo…' : 'Escolher .zip'}<input type="file" accept=".zip,application/zip" hidden disabled={restaurando} onchange={restaurarCopia}></label></div>
          {#if restaurada}
            <div class="config-aviso" role="status">
              <p>Cópia conferida: {restaurada.contas} conta(s) e {restaurada.conversas} conversa(s). {#if desktop}Reabra o Gyde para usar.{:else}Feche o Gyde (a janela do iniciar.bat) e abra de novo para usar.{/if}</p>
              {#if desktop}<button type="button" class="btn primary small" onclick={() => desktop!.reiniciar()}>Reabrir agora</button>{/if}
            </div>
          {/if}
          {/if}
          <div class="config-linha perigo"><div><b>Apagar todas as conversas do chat</b><small>Não dá para desfazer.</small></div><button type="button" class="btn ghost" onclick={() => apagar('conversas')}>Apagar</button></div>
          {#if pessoal}<div class="config-linha perigo"><div><b>Apagar todas as conversas da Forja</b><small>Os arquivos dos seus projetos não são tocados.</small></div><button type="button" class="btn ghost" onclick={() => apagar('forja')}>Apagar</button></div>{/if}
          <div class="config-linha perigo"><div><b>Apagar o registro de uso</b><small>Zera os contadores de pedidos e tokens do painel Uso e limites.</small></div><button type="button" class="btn ghost" onclick={() => apagar('uso')}>Apagar</button></div>
        </section>
      {:else}
        <section class="config-painel" role="tabpanel" data-painel="extensoes">
          <p class="config-nota">Gere um token e cole na extensão do Gyde para o Chrome ou para o VS Code. Ele dá acesso à sua conta, então não compartilhe.</p>
          {#if tokenNovo}
            <div class="token-new"><code>{tokenNovo}</code><button type="button" class="btn small" onclick={(e) => copiar(tokenNovo, e.currentTarget)}>Copiar</button><small>Copie agora: este token não será mostrado de novo.</small></div>
          {/if}
          <ul class="token-list">
            {#each tokens as t (t.id)}<li><span>{t.name} · criado em {data(t.created_at)} · último uso: {data(t.last_used)}</span><button type="button" onclick={() => revogar(t.id)}>Revogar</button></li>{/each}
          </ul>
          <button type="button" class="btn ghost" onclick={gerarToken}>Gerar token</button>
        </section>
      {/if}
    </div>
  </div>
</dialog>
