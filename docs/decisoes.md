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
9. **Instabilidade do teste da Loja de skills no Windows do CI.** Na execução do push da 2.5.0, o clique em "Ver e
   instalar" não abriu o diálogo em 8 s (só no Windows; a execução do PR do mesmo commit passou nos 3 sistemas). O log
   não mostra a causa; a hipótese é o clique cair durante o redesenho da lista. O teste agora repete o clique até o
   diálogo abrir (até 15 s) e continua conferindo o conteúdo. A causa exata fica em aberto para a Fase 3.
10. **Fase 2: o plano continua opcional.** A medição da 2.4.x mostrou que o plano antes de tarefas grandes não melhorou o
    resultado e dobrou as rodadas. Em vez de ligar o plano para todos, a Fase 2 investe no que o Gyde pode conferir
    sozinho: argumentos das ferramentas, laço, verificação depois da última mudança e afirmações sem base.
11. **"Verificado" vem do que rodou, não do texto do modelo.** A linha embaixo da resposta da Forja diz "Verificado"
    só quando um comando rodou sem erro depois da última mudança de arquivo; "Verificação falhou" quando o último deu
    erro; "Não verificado" quando nada rodou. Se a resposta afirma que os testes passaram sem isso, aparece um aviso
    "Conferido pelo Gyde". A Forja pede uma vez para corrigir antes de terminar com o teste falhando.
12. **Laço:** a mesma ação (mesma ferramenta e mesmos argumentos) que falha de novo recebe um aviso para mudar de
    caminho; 3 rodadas seguidas só com repetições presas encerram a tarefa com a explicação, em vez de gastar as 30
    rodadas e a cota grátis.
13. **GYDE.md entra abaixo das regras de segurança** e passa pelo filtro de segredos. É texto do projeto: pode orientar
    estilo e comandos, mas não libera nada que as regras do Gyde bloqueiam.
14. **Cenário "redesenhar site" medido por programa:** build, axe-core sem violação séria ou crítica, caber em 375 px
    (com a meta viewport; sem ela o celular desenha com 980 px e o critério passava sem mérito, corrigido antes de
    medir) e mudança além da paleta. Conferido com o site original (falha em 3) e com um redesenho feito à mão (passa
    em todos) antes de medir a Forja.
15. **Medição da Fase 2 (18/11/2026, NVIDIA + Groq, `ferramentas/avaliar-forja.mjs`).** Fase 2 sem a conferência de
    site contra a 2.5.0, 3 execuções por cenário: pequenos 12/12 nos dois, difíceis 12/12 nos dois (já no teto: a
    medição não consegue mostrar ganho neles), site 1/3 contra 0/3. Tempo mediano 28 s contra 40 s. As mudanças de
    honestidade (verificação, avisos, laço, argumentos) quase não aparecem nesses cenários porque os modelos já
    terminavam bem; elas são conferidas pelos testes com o provedor falso, que forçam cada situação.
16. **A conferência de site fica, marcada como tendência.** Primeira rodada: não melhorou (2 falhas e um estouro de
    tempo); a causa foi o verificador ler as cores do tema escuro e ignorar degradês. Corrigido com casos de teste
    tirados da falha real. Segunda rodada, mesmo período, n = 6 de cada lado: 5/6 com a conferência contra 4/6 sem,
    +17 pontos, intervalo de 90% de -17 a +50 (incerto). Somando as rodadas anteriores sem a conferência (mesmo
    código, outros horários): 5/6 contra 7/15, +37 [+3, +67]. Tempo mediano 115 s contra 249 s. Fica porque não
    piorou nada medido, só entra em pedido visual e só nos arquivos que a tarefa mudou; a ressalva é que a conferência
    foi ajustada olhando uma falha do próprio cenário medido.
17. **O limpar-antigos.ps1 apagou as cópias de trabalho do git em %TEMP%** (gyde-fase3 e as de medição) ao limpar
    os temporários gyde-*. Nada se perdeu: todos os commits já estavam no repositório. O script agora pula qualquer
    pasta gyde-* que tenha um .git dentro.
