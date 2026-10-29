<script lang="ts">
  // Entrar, criar conta, confirmar e-mail e trocar senha. No modo pessoal não há e-mail: a conta fica no PC.
  import { tick } from 'svelte';
  import Cartao from './Cartao.svelte';
  import { desktop } from '../desktop.ts';

  let { modo, modoEmail, onentrar }: { modo?: string; modoEmail?: string; onentrar: () => void } = $props();

  type Tela = 'login' | 'cadastro' | 'confirmar' | 'senhaLocal' | 'esqueci' | 'novaSenha';
  let tela = $state<Tela>('login');
  let direcao = $state<'next' | null>(null);
  let nome = $state(''), email = $state(''), senha = $state(''), codigo = $state('');
  let erro = $state(''), tremer = $state(0), ocupado = $state(false), reenviado = $state(false);
  let caixa: HTMLElement | undefined = $state();

  const pessoal = $derived(modo === 'pessoal');
  // no app de desktop a troca de senha é feita aqui mesmo, com confirmação numa janela do Windows
  let trocada = $state(false);
  const SENHA_DICA = 'Mínimo de 8 caracteres, com letras e números.';

  function ir(t: Tela, d: 'next' | null = null) {
    tela = t; direcao = d; erro = ''; senha = ''; codigo = ''; reenviado = false;
  }
  // cada tela nova começa com o cursor no primeiro campo
  $effect(() => { void caixa; tick().then(() => caixa?.querySelector<HTMLInputElement>('input')?.focus()); });

  function mostrarErro(msg: string) { erro = msg; tremer++; }
  async function post(url: string, dados: Record<string, unknown>) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1' }, body: JSON.stringify(dados) });
    let json: { user?: unknown; error?: string; needsVerification?: boolean; email?: string } = {};
    try { json = await r.json(); } catch { /* sem corpo */ }
    return { ok: r.ok, json };
  }
  async function enviar(e: SubmitEvent, url: string, dados: Record<string, unknown>, depois: (r: Awaited<ReturnType<typeof post>>) => void, padrao: string) {
    e.preventDefault();
    ocupado = true;
    let r;
    try { r = await post(url, dados); } catch { ocupado = false; mostrarErro('Não consegui falar com o servidor do Gyde.'); return; }
    ocupado = false;
    if (r.ok || r.json.needsVerification) depois(r);
    else mostrarErro(r.json.error || padrao);
  }

  const entrar = (e: SubmitEvent) => enviar(e, '/api/auth/login', { email, password: senha }, (r) => {
    if (r.ok) onentrar(); else ir('confirmar');
  }, 'Não deu para entrar agora.');
  const cadastrar = (e: SubmitEvent) => enviar(e, '/api/auth/register', { name: nome, email, password: senha }, (r) => {
    if (r.json.user) onentrar(); else ir('confirmar'); // modo pessoal já entra
  }, 'Não deu para criar a conta agora.');
  const confirmar = (e: SubmitEvent) => enviar(e, '/api/auth/verify', { email, code: codigo }, onentrar, 'Código inválido.');
  const pedirCodigo = (e: SubmitEvent) => enviar(e, '/api/auth/forgot', { email }, () => ir('novaSenha'), 'Não deu para mandar o código agora.');
  const trocarSenha = (e: SubmitEvent) => enviar(e, '/api/auth/reset', { email, code: codigo, password: senha }, onentrar, 'Não deu para trocar a senha agora.');
  async function reenviar() {
    const r = await post('/api/auth/resend', { email });
    if (r.ok) { reenviado = true; erro = ''; } else mostrarErro(r.json.error || 'Não deu para reenviar agora.');
  }
  async function trocarLocal(e: SubmitEvent) {
    e.preventDefault();
    ocupado = true;
    const r = await desktop!.redefinirSenha(email, senha);
    ocupado = false;
    if (r.ok) { trocada = true; senha = ''; erro = ''; }
    else if (!r.cancelado) mostrarErro(r.erro || 'Não deu para trocar a senha agora.');
  }
  async function importar() {
    const r = await desktop!.importarDados();
    if (!r.ok && !r.cancelado) mostrarErro(r.erro || 'Não deu para importar agora.');
  }
  const soDigitos = () => { codigo = codigo.replace(/\D/g, '').slice(0, 6); };
</script>

{#snippet campoErro()}
  {#key tremer}<p class="gate-error" role="alert" hidden={!erro}>{erro}</p>{/key}
{/snippet}
{#snippet avisoTeste()}
  {#if modoEmail === 'console'}<p class="gate-note">Modo de teste: o código aparece no terminal do servidor.</p>{/if}
{/snippet}

{#key tela}
  <div bind:this={caixa} style="display:contents">
    <Cartao {direcao}>
      {#if tela === 'login'}
        <h1>Entrar</h1>
        <p class="gate-sub">Bem-vindo de volta! Bora programar?</p>
        <form class="gate-form" novalidate onsubmit={entrar}>
          <label>E-mail<input name="email" type="email" autocomplete="email" required bind:value={email} disabled={ocupado}></label>
          <label>Senha<input name="password" type="password" autocomplete="current-password" required bind:value={senha} disabled={ocupado}></label>
          {@render campoErro()}
          <button class="btn primary wide" disabled={ocupado}>Entrar</button>
        </form>
        <div class="gate-links">
          <button type="button" class="link" onclick={() => ir(pessoal ? 'senhaLocal' : 'esqueci', pessoal ? 'next' : null)}>Esqueci minha senha</button>
          <span>Não tem conta? <button type="button" class="link" onclick={() => ir('cadastro')}>Criar conta</button></span>
        </div>
        {#if desktop}
          <p class="gate-note gate-importar">Já usava o Gyde antes deste app? <button type="button" class="link" onclick={importar}>Trazer seus dados</button></p>
        {/if}
      {:else if tela === 'cadastro'}
        <h1>Criar conta</h1>
        <p class="gate-sub">Seu guia na programação, em português.</p>
        {#if pessoal}<p class="gate-note">Modo pessoal: sua conta e suas conversas ficam só neste computador. O e-mail serve apenas para entrar — pode ser qualquer um, e nada é enviado.</p>
        {:else if modoEmail === 'off'}<p class="gate-note">⚠︎ O envio de e-mail ainda não foi configurado neste computador. Rode o <b>configurar-email.bat</b> (pasta <b>configurar</b> do Gyde) antes de criar contas.</p>{/if}
        <form class="gate-form" novalidate onsubmit={cadastrar}>
          <label>Como quer ser chamado?<input name="name" autocomplete="given-name" maxlength="60" required bind:value={nome} disabled={ocupado}></label>
          <label>E-mail<input name="email" type="email" autocomplete="email" required bind:value={email} disabled={ocupado}></label>
          <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required bind:value={senha} disabled={ocupado}><small>{SENHA_DICA}</small></label>
          {@render campoErro()}
          <button class="btn primary wide" disabled={ocupado}>Criar conta</button>
        </form>
        <div class="gate-links"><span>Já tem conta? <button type="button" class="link" onclick={() => ir('login')}>Entrar</button></span></div>
      {:else if tela === 'confirmar'}
        <h1>Confirme seu e-mail</h1>
        <p class="gate-sub">Mandamos um código de 6 dígitos para <b>{email}</b>.</p>
        {@render avisoTeste()}
        <form class="gate-form" novalidate onsubmit={confirmar}>
          <label>Código<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="code-input" required bind:value={codigo} oninput={soDigitos} disabled={ocupado}></label>
          {@render campoErro()}
          <button class="btn primary wide" disabled={ocupado}>Confirmar</button>
        </form>
        <div class="gate-links">
          <button type="button" class="link" disabled={reenviado} onclick={reenviar}>{reenviado ? 'Código reenviado' : 'Reenviar código'}</button>
          <button type="button" class="link" onclick={() => ir('login')}>Voltar</button>
        </div>
      {:else if tela === 'senhaLocal' && desktop}
        <h1>Trocar senha</h1>
        {#if trocada}
          <p class="gate-sub">Senha trocada. Entre com a senha nova.</p>
          <button type="button" class="btn primary wide" onclick={() => { trocada = false; ir('login'); }}>Voltar para entrar</button>
        {:else}
          <p class="gate-sub">A conta fica só neste computador, então a troca é feita aqui. O Windows vai pedir para você confirmar.</p>
          <form class="gate-form" novalidate onsubmit={trocarLocal}>
            <label>E-mail da conta<input name="email" type="email" autocomplete="email" required bind:value={email} disabled={ocupado}></label>
            <label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="8" required bind:value={senha} disabled={ocupado}><small>{SENHA_DICA}</small></label>
            {@render campoErro()}
            <button class="btn primary wide" disabled={ocupado}>Trocar senha</button>
          </form>
          <div class="gate-links"><button type="button" class="link" onclick={() => ir('login')}>Voltar</button></div>
        {/if}
      {:else if tela === 'senhaLocal'}
        <h1>Esqueceu a senha?</h1>
        <p class="gate-sub">No modo pessoal a conta fica só neste computador, então a troca é feita aqui mesmo:</p>
        <ol class="gate-steps">
          <li>Abra a pasta do projeto do Gyde.</li>
          <li>Na pasta <b>ferramentas</b>, dê dois cliques em <b>redefinir-senha.bat</b>.</li>
          <li>Escolha a sua conta e digite a senha nova.</li>
        </ol>
        <button type="button" class="btn primary wide" onclick={() => ir('login')}>Voltar para entrar</button>
      {:else if tela === 'esqueci'}
        <h1>Trocar senha</h1>
        <p class="gate-sub">Vamos mandar um código para o seu e-mail.</p>
        <form class="gate-form" novalidate onsubmit={pedirCodigo}>
          <label>E-mail<input name="email" type="email" autocomplete="email" required bind:value={email} disabled={ocupado}></label>
          {@render campoErro()}
          <button class="btn primary wide" disabled={ocupado}>Enviar código</button>
        </form>
        <div class="gate-links"><button type="button" class="link" onclick={() => ir('login')}>Voltar</button></div>
      {:else}
        <h1>Nova senha</h1>
        <p class="gate-sub">Se existir uma conta com <b>{email}</b>, o código chegou lá.</p>
        {@render avisoTeste()}
        <form class="gate-form" novalidate onsubmit={trocarSenha}>
          <label>Código<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="code-input" required bind:value={codigo} oninput={soDigitos} disabled={ocupado}></label>
          <label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="8" required bind:value={senha} disabled={ocupado}><small>{SENHA_DICA}</small></label>
          {@render campoErro()}
          <button class="btn primary wide" disabled={ocupado}>Trocar senha</button>
        </form>
        <div class="gate-links"><button type="button" class="link" onclick={() => ir('login')}>Voltar</button></div>
      {/if}
    </Cartao>
  </div>
{/key}
