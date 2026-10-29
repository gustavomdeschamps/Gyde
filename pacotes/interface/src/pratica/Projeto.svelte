<script lang="ts">
  // Página de um projeto guiado: o que é, arquivos iniciais, etapas com tarefas e critérios, conferência no servidor,
  // dica, revisão do Gyde no chat e, no fim, a explicação da solução e os próximos desafios.
  import { untrack } from 'svelte';
  import * as C from '$contratos';
  import type { TEstadoPratica } from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';
  import { confetti } from '../runner.ts';
  import { icons, NIVEL_NOME } from './icones.ts';

  let { dados, projetoId, toast, onatualizar, abrirNoChat }: {
    dados: TEstadoPratica; projetoId: string; toast: (t: string) => void; onatualizar: (d: TEstadoPratica) => void;
    abrirNoChat: (texto: string) => void;
  } = $props();

  const p = $derived(dados.projetos.find((x) => x.id === projetoId)!);
  const feitas = $derived(p.etapas.filter((e) => e.feita).length);
  const atual = $derived(p.etapas.findIndex((e) => !e.feita));
  const chave = (etapaId: string) => `${p.id}:${etapaId}`;

  // o que a pessoa colou fica enquanto a página está aberta; o que já foi conferido vem do servidor
  const rascunhos = ((globalThis as { __rascunhosProjeto?: Record<string, string> }).__rascunhosProjeto ??= {});
  // valor inicial de propósito: a página é recriada para cada projeto ({#key} em Pratica.svelte)
  const codigos = $state<Record<string, string>>(untrack(() => Object.fromEntries(p.etapas.map((e) => [e.id, rascunhos[chave(e.id)] ?? dados.progress[chave(e.id)]?.code ?? '']))));
  $effect(() => { for (const [id, c] of Object.entries(codigos)) rascunhos[chave(id)] = c; });
  let conferindo = $state('');
  let resultados = $state<Record<string, { descricao: string; ok: boolean }[]>>({});

  async function conferir(etapaId: string) {
    conferindo = etapaId;
    try {
      const r = await pedir(`/api/pratica/projeto/${encodeURIComponent(p.id)}/etapa/${encodeURIComponent(etapaId)}`, C.ConferenciaEtapa, corpo({ codigo: codigos[etapaId] ?? '' }));
      resultados[etapaId] = r.conferencia.criterios;
      onatualizar(r);
      const xp = r.ganhos.reduce((n, g) => n + g.xp, 0);
      if (r.conferencia.ok) { toast(xp ? `Etapa conferida: +${xp} XP` : 'Etapa conferida de novo: tudo certo.'); if (r.ganhos.some((g) => g.motivo === 'Projeto concluído')) confetti(); }
      else toast(`Faltam ${r.conferencia.criterios.filter((c) => !c.ok).length} critério(s). Veja a lista da etapa.`);
    } catch (e) { toast(mensagemDe(e)); }
    conferindo = '';
  }

  function copiar(texto: string) { navigator.clipboard.writeText(texto).then(() => toast('Copiado.'), () => toast('Não deu para copiar.')); }
  function baixar(nome: string, conteudo: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: 'text/plain;charset=utf-8' }));
    a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function revisar(e: (typeof p.etapas)[number]) {
    abrirNoChat(`Projeto guiado de ${p.tecnologia}: ${p.nome}, etapa "${e.titulo}".\nTarefas:\n${e.tarefas.map((t) => `- ${t}`).join('\n')}\n\nMeu ${e.arquivo}:\n\`\`\`\n${codigos[e.id] || '(ainda não escrevi)'}\n\`\`\`\n\nRevise sem me dar a solução pronta: aponte o que falta e o que pode dar errado.`);
  }
  const pedirDesafio = (d: string) => abrirNoChat(`Terminei o projeto "${p.nome}" (${p.tecnologia}). Quero fazer este próximo desafio: ${d}\nMe guie em etapas, sem me dar a resposta pronta.`);
</script>

{#if p}
  <div class="skills-inner projeto">
    <nav class="crumbs"><a href="#/pratica">Prática</a><span>›</span><span>Projetos guiados</span><span>›</span><span>{p.nome}</span></nav>
    <header class="skills-hero">
      <div>
        <div class="guiado-topo" style="justify-content:flex-start"><span class="lang-badge">{p.tecnologia}</span><small>nível {NIVEL_NOME[p.nivel]}</small></div>
        <h1>{p.nome}</h1><p>{p.descricao}</p>
      </div>
      <div style="min-width:220px"><div class="track-meta" style="margin-bottom:8px"><span>{feitas}/{p.etapas.length} etapas</span><span>{p.concluido ? 'Concluído' : 'Em andamento'}</span></div><div class="progress"><span style="width:{Math.round((feitas / p.etapas.length) * 100)}%"></span></div></div>
    </header>

    <section class="projeto-sobre">
      <div><h2>Objetivo</h2><p>{p.objetivo}</p></div>
      <div><h2>Resultado esperado</h2><p>{p.resultado}</p></div>
      <div><h2>Tecnologias</h2><ul>{#each p.tecnologias as t}<li>{t}</li>{/each}</ul></div>
      <div><h2>Antes de começar, saiba</h2><ul>{#each p.prerequisitos as t}<li>{t}</li>{/each}</ul></div>
    </section>

    <section>
      <h2 class="section-title">Arquivos iniciais <small>crie na sua pasta e abra no seu editor</small></h2>
      {#each p.arquivos as a (a.nome)}
        <div class="projeto-arquivo">
          <div class="projeto-arquivo-topo"><code>{a.nome}</code><span><button type="button" class="btn small ghost" onclick={() => copiar(a.conteudo)}>Copiar</button><button type="button" class="btn small ghost" onclick={() => baixar(a.nome, a.conteudo)}>Baixar</button></span></div>
          <pre><code>{a.conteudo}</code></pre>
        </div>
      {/each}
    </section>

    <h2 class="section-title">Etapas <small>o Gyde confere a estrutura do código que você colar (não executa)</small></h2>
    <ol class="projeto-etapas">
      {#each p.etapas as e, i (e.id)}
        {@const res = resultados[e.id]}
        <li class="projeto-etapa" class:feita={e.feita} class:atual={i === atual}>
          <details open={i === atual || (res !== undefined && !e.feita)}>
            <summary><span class="ex-num">{#if e.feita}{@html icons.check}{:else}{i + 1}{/if}</span><b>{e.titulo}</b><span class="xp-pill">+{e.xp} XP</span></summary>
            <p>{e.explicacao}</p>
            <h3>Tarefas</h3>
            <ul>{#each e.tarefas as t}<li>{t}</li>{/each}</ul>
            <h3>O que é conferido</h3>
            <ul class="projeto-criterios">
              {#each e.criterios as c, j}
                {@const r = res?.[j]}
                <li class:ok={r?.ok || (!res && e.feita)} class:falta={r && !r.ok}>{#if r?.ok || (!res && e.feita)}{@html icons.check}{:else if r}{@html icons.x}{/if}{c}</li>
              {/each}
            </ul>
            <details class="projeto-dica"><summary>{@html icons.bulb}Ver dica</summary><p>{e.dica}</p></details>
            <label class="projeto-entrega"><span>Cole aqui o conteúdo do seu <code>{e.arquivo}</code></span>
              <textarea bind:value={codigos[e.id]} rows="10" spellcheck="false" placeholder="Escreva no seu editor e cole aqui o arquivo inteiro"></textarea>
            </label>
            <div class="guiado-acoes">
              <button type="button" class="btn primary" disabled={conferindo === e.id || !codigos[e.id]?.trim()} onclick={() => conferir(e.id)}>{conferindo === e.id ? 'Conferindo…' : e.feita ? 'Conferir de novo' : 'Conferir etapa'}</button>
              <button type="button" class="btn ghost" onclick={() => revisar(e)}>Pedir revisão ao Gyde</button>
            </div>
          </details>
        </li>
      {/each}
    </ol>

    {#if p.concluido && p.explicacaoSolucao}
      <section class="projeto-fim">
        <h2 class="section-title">Como a solução funciona</h2>
        <p>{p.explicacaoSolucao}</p>
        <h2 class="section-title">Próximos desafios</h2>
        <ul class="projeto-desafios">{#each p.proximosDesafios as d}<li><span>{d}</span><button type="button" class="btn small ghost" onclick={() => pedirDesafio(d)}>Fazer com o Gyde</button></li>{/each}</ul>
      </section>
    {:else}
      <p class="plano-obs">Ao concluir todas as etapas, aparecem aqui a explicação da solução e os próximos desafios.</p>
    {/if}
  </div>
{/if}
