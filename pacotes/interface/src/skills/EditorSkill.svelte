<script lang="ts">
  // Criar ou editar uma skill própria (diálogo).
  import { onMount, untrack } from 'svelte';
  import * as C from '$contratos';
  import type { TSkill } from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';
  import { icone as svgIcone } from '../icones.ts';

  let { existente, onsalvo, onfechar }: { existente: TSkill | null; onsalvo: (r: { id: string; skills: TSkill[] }) => void; onfechar: () => void } = $props();

  // ícones que a pessoa pode escolher (do conjunto do Gyde), com o nome que o leitor de tela fala
  const ICONES: [string, string][] = [['puzzle', 'peça'], ['file-code', 'código'], ['bug', 'inseto'], ['flask-conical', 'teste'], ['database', 'banco de dados'], ['globe', 'site'],
    ['palette', 'design'], ['plug', 'API'], ['smartphone', 'celular'], ['gamepad-2', 'jogo'], ['chart-column', 'gráfico'], ['sheet', 'planilha'],
    ['shield-check', 'segurança'], ['key-round', 'chave'], ['git-branch', 'git'], ['rocket', 'publicar'], ['book-open', 'documentação'], ['graduation-cap', 'estudo'],
    ['lightbulb', 'ideia'], ['square-terminal', 'terminal'], ['workflow', 'automação'], ['brain', 'raciocínio'], ['map', 'plano'], ['sparkles', 'destaque']];
  const MODELO = '## Passos\n1. Explique com exemplos em Java 21.\n2. Compare com Python quando ajudar.\n\n## Checklist\n- Termina com um exercício curto.\n\n## Erros comuns\n- Esquecer de fechar o Scanner.';
  // o formulário começa com os dados de quando abriu; mudanças depois não o reescrevem
  const inicial = untrack(() => existente) ?? { nome: '', descricao: '', icone: 'puzzle', comando: '/', gatilhos: [] as string[], corpo: '' };
  let nome = $state(inicial.nome), comando = $state(inicial.comando), descricao = $state(inicial.descricao);
  let gatilhos = $state(inicial.gatilhos.join(', ')), texto = $state(inicial.corpo), icone = $state(inicial.icone);
  let erro = $state<string | null>(null);
  let dialogo: HTMLDialogElement | undefined = $state();
  let campoNome: HTMLInputElement | undefined = $state();

  onMount(() => { dialogo!.showModal(); campoNome?.focus(); });

  async function salvar(e: SubmitEvent) {
    if ((e.submitter as HTMLButtonElement | null)?.value !== 'save') return;
    e.preventDefault();
    const dados = { nome, descricao, icone, comando: comando.trim() === '/' ? '' : comando.trim().toLowerCase(), gatilhos, corpo: texto };
    try {
      const r = await pedir(existente ? `/api/skills/custom/${existente.id}` : '/api/skills/custom', C.SkillSalva, { ...corpo(dados), method: existente ? 'PUT' : 'POST' });
      dialogo?.close();
      onsalvo(r);
    } catch (err) { erro = mensagemDe(err); }
  }
</script>

<dialog class="dialog wide-dialog" bind:this={dialogo} onclose={onfechar}>
  <form method="dialog" class="skill-form" onsubmit={salvar}>
    <h2>{existente ? 'Editar skill' : 'Criar skill'}</h2>
    <div class="form-row">
      <label class="grow">Nome<input name="nome" maxlength="60" required placeholder="Ex.: Professor de Java" bind:value={nome} bind:this={campoNome}></label>
      <label>Comando<input name="comando" maxlength="25" placeholder="/java" pattern="/[a-z0-9-]{'{'}2,24{'}'}" bind:value={comando}></label>
    </div>
    <span class="label-like" id="skIconeRotulo">Ícone</span>
    <div class="symbol-picker" role="radiogroup" aria-labelledby="skIconeRotulo">
      {#each ICONES as [nomeIcone, rotulo] (nomeIcone)}<button type="button" role="radio" aria-checked={nomeIcone === icone} aria-label={rotulo} title={rotulo} class:selected={nomeIcone === icone} onclick={() => (icone = nomeIcone)}>{@html svgIcone(nomeIcone)}</button>{/each}
    </div>
    <label>Descrição curta<input name="descricao" maxlength="240" placeholder="O que essa skill faz, em uma frase" bind:value={descricao}></label>
    <label>Palavras que ativam sozinha <small>(separadas por vírgula, opcional)</small><input name="gatilhos" placeholder="java, spring, orientação a objetos" bind:value={gatilhos}></label>
    <label>Instruções para o Gyde<textarea name="corpo" rows="9" maxlength="8000" required bind:value={texto}
      placeholder={MODELO}></textarea></label>
    {#if existente?.publicada}<p class="loja-aviso">Esta skill está na loja. Depois de salvar, use "Atualizar na loja" para publicar as mudanças.</p>{/if}
    {#if erro}<p class="gate-error" role="alert">{erro}</p>{/if}
    <div class="dialog-actions"><button value="cancel" class="btn ghost" formnovalidate>Cancelar</button><button value="save" class="btn primary">Salvar skill</button></div>
  </form>
</dialog>
