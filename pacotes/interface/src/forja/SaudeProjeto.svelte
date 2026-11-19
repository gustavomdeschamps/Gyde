<script lang="ts">
  // Saúde do projeto (aba Cidade): contagens tiradas do mapa da pasta e das ruas de dependência, sem nota inventada.
  // Arquivos grandes, dependências em ciclo, código que ninguém importa, testes e os mais alterados, cada um com um
  // atalho para ver na cidade ou pedir à Forja (o pedido só é escrito no campo; quem envia é a pessoa).
  import type { TCidade } from '$contratos';
  import { nomeDe } from './cidade-comum.ts';

  let { cidade, onver, onpedirForja }: { cidade: TCidade; onver?: (caminho: string) => void; onpedirForja?: (texto: string) => void } = $props();
  const s = $derived(cidade.saude);
  const n = (x: number) => x.toLocaleString('pt-BR');
  const pontos = $derived((s.grandes.length ? 1 : 0) + (s.ciclos.length ? 1 : 0) + (s.semUso.total ? 1 : 0) + (s.arquivosDeTeste === 0 && s.arquivosDeCodigo > 3 ? 1 : 0));
</script>

<details class="saude">
  <summary><b>Saúde do projeto</b> <small>{pontos ? `${pontos} ${pontos === 1 ? 'ponto para olhar' : 'pontos para olhar'}` : 'nada que chame atenção'}</small></summary>
  <div class="saude-corpo">
    <p>{n(s.arquivosDeCodigo)} arquivos de código, {n(s.linhasDeCodigo)} linhas, {n(s.arquivosDeTeste)} {s.arquivosDeTeste === 1 ? 'arquivo de teste' : 'arquivos de teste'}; {n(cidade.ruas.length)} {cidade.ruas.length === 1 ? 'dependência' : 'dependências'} entre arquivos{#if cidade.ruasCortadas} (mais {n(cidade.ruasCortadas)} que ficaram de fora para a cidade não pesar){/if}.</p>
    {#if s.arquivosDeTeste === 0 && s.arquivosDeCodigo > 3}
      <section><h4>Sem testes</h4><p>Nenhum arquivo de teste encontrado. Testes avisam quando uma mudança quebra algo.</p>
        {#if onpedirForja}<button type="button" class="btn small" onclick={() => onpedirForja('Crie testes para as partes principais deste projeto, no estilo que ele já usa, e rode os testes.')}>Pedir testes à Forja</button>{/if}</section>
    {/if}
    {#if s.grandes.length}
      <section><h4>Arquivos grandes (mais de 500 linhas)</h4>
        <ul>{#each s.grandes as g (g.caminho)}<li><code title={g.caminho}>{nomeDe(g.caminho)}</code> {n(g.linhas)} linhas
          {#if onver}<button type="button" class="link-btn" onclick={() => onver(g.caminho)}>ver na cidade</button>{/if}
          {#if onpedirForja}<button type="button" class="link-btn" onclick={() => onpedirForja(`Divida o arquivo ${g.caminho} em partes menores, sem mudar o comportamento, e rode os testes.`)}>pedir para dividir</button>{/if}</li>{/each}</ul>
      </section>
    {/if}
    {#if s.ciclos.length}
      <section><h4>Dependências em ciclo</h4><p>Arquivos que importam um ao outro: mudar um pode quebrar o outro.</p>
        <ul>{#each s.ciclos as c, i (i)}<li><code>{[...c, c[0]].map((x) => nomeDe(x ?? '')).join(' → ')}</code></li>{/each}</ul>
      </section>
    {/if}
    {#if s.semUso.total}
      <section><h4>Código que ninguém importa ({n(s.semUso.total)})</h4><p>Pode ser código esquecido, ou algo que é carregado de outro jeito. Confira antes de apagar.</p>
        <ul>{#each s.semUso.exemplos as c (c)}<li><code title={c}>{c}</code>{#if onver}<button type="button" class="link-btn" onclick={() => onver(c)}>ver na cidade</button>{/if}</li>{/each}</ul>
      </section>
    {/if}
    {#if s.maisAlterados.length}
      <section><h4>Mais alterados no git</h4>
        <ul>{#each s.maisAlterados as m (m.caminho)}<li><code title={m.caminho}>{nomeDe(m.caminho)}</code> {n(m.mudancas)} {m.mudancas === 1 ? 'mudança' : 'mudanças'}</li>{/each}</ul>
      </section>
    {/if}
  </div>
</details>
