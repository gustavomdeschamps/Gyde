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
