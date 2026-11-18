# Decisões da sessão longa

Cada decisão importante, com o motivo. As mais recentes ficam no fim.

1. **A 2.4.2 não existia em lugar nenhum** (nem branch, nem worktree, nem stash; as branches `estrutura-nova` e
   `evolucao` são antigas e já estão na principal). Os quatro itens previstos para ela (validação dos argumentos da
   Forja, quebra de laço, honestidade das afirmações, fluxo de redesenhar site) entram na Fase 2, que é sobre a Forja.
2. **A verificação do código roda depois que a resposta chega inteira, não antes de mostrar.** Segurar a resposta até
   conferir acabaria com o texto chegando aos poucos, que é parte da sensação de qualidade. Quando a verificação muda a
   resposta (correção ou acabamento), a tela troca o texto pela versão final e só ela é salva.
3. **O que roda na verificação:** JavaScript num processo Node com o modelo de permissões ligado (sem disco, sem
   processos); Python só se houver Python no computador e só código sem módulos que mexem no sistema, sem arquivo,
   teclado ou código dinâmico (o Python não tem caixa de areia). Blocos apresentados como "o código com erro" não
   rodam, porque o tutor mostra o erro de propósito. Tempo limite de 4 s por bloco.
4. **"Antes de mostrar" no guia virou "nunca diga que rodou":** o modelo não roda nada; quem roda é o Gyde, e é ele que
   escreve a linha "Código conferido".
5. **O guia de estilo novo fica.** Medição de 18/11/2026 (`ferramentas/avaliar-estilo.mjs`, 40 pedidos separados, 2
   execuções de cada, mesmos modelos dos dois lados, n = 80 por lado): nota 99% contra 97%, diferença +3 pontos,
   intervalo de 90% de +1 a +4. O ganho vem quase todo do código: "o código roda" 98% contra 87% (n = 45 respostas
   com código), com 8 respostas corrigidas pela verificação. "Começa pela resposta" e "sem fórmula de abertura ou
   fecho" ficaram em 100% nos dois lados, ou seja, a medição não mostra diferença nesses dois pontos. Tamanho
   proporcional 99% contra 95%; mediana de palavras 42 contra 50; tempo mediano 4,5 s contra 4,3 s.
   Ressalva: o critério "código roda" também conta como falha um bloco que mostra um erro de propósito sem avisar no
   texto antes; isso pesa um pouco contra a versão antiga.
6. **Votos ficam só no banco local.** Polegar e "Comparar respostas" não saem do computador; quem quiser usar os votos
   para ajustar o guia roda `node ferramentas/resumir-votos.mjs`, que só lê o banco. Ainda não há votos reais, então o
   guia não foi ajustado por votos nesta versão (seria inventar).
7. **Título e resumo da conversa usam os modelos da resposta como reserva.** Ao refazer as capturas, os títulos não
   apareciam: os modelos utilitários (`CADEIAS.util`) só existem no FreeLLMAPI, e quem usa só as chaves diretas
   (NVIDIA, Groq) ficava sempre com "Nova conversa" e sem resumo das conversas longas. Agora, se os utilitários
   falham, vão os mesmos modelos que responderam. Conferido com 3 pedidos reais: "Filtrar números pares em
   JavaScript", "IndexError em listas Python", "Centralizar div com CSS".
8. **"Código conferido" não diz mais do que rodar provou.** Se o código só define uma função, sem nenhum uso
   (`console.log`, `print`, `assert`), rodar só mostra que não há erro de sintaxe; a linha passa a dizer isso.
