# Relatório da sessão longa (18 e 19/11/2026)

Seis fases, cada uma com branch, PR, CI verde nos 3 sistemas (Windows, Linux e macOS) e merge. As decisões, com o
motivo de cada uma, estão em [decisoes.md](decisoes.md); o andamento, em [andamento.md](andamento.md). Números sempre
com o tamanho da amostra; onde houve comparação, com o intervalo de 90% (reamostragem).

## Versões publicadas

| Fase | Versão | PR | Release |
|---|---|---|---|
| 1. Respostas | 2.5.0 | [#7](https://github.com/gustavomdeschamps/Gyde/pull/7) | [v2.5.0](https://github.com/gustavomdeschamps/Gyde/releases/tag/v2.5.0) |
| 2. Forja | 2.6.0 | [#8](https://github.com/gustavomdeschamps/Gyde/pull/8) | [v2.6.0](https://github.com/gustavomdeschamps/Gyde/releases/tag/v2.6.0) |
| 3. Qualidade | 2.7.0 | [#9](https://github.com/gustavomdeschamps/Gyde/pull/9) | [v2.7.0](https://github.com/gustavomdeschamps/Gyde/releases/tag/v2.7.0) |
| 4. Primeiro uso | 2.8.0 | [#10](https://github.com/gustavomdeschamps/Gyde/pull/10) | [v2.8.0](https://github.com/gustavomdeschamps/Gyde/releases/tag/v2.8.0) |
| 5. Cidade e Ao vivo | 2.9.0 | [#11](https://github.com/gustavomdeschamps/Gyde/pull/11) | sem instalador próprio (veja a revisão) |
| 6. Site, documentação, revisão e limpeza | 2.10.0 | [#12](https://github.com/gustavomdeschamps/Gyde/pull/12) | [v2.10.0](https://github.com/gustavomdeschamps/Gyde/releases/tag/v2.10.0) |

Cada Release tem o instalador do Windows, o `latest.yml` da atualização automática, o `.vsix` do VS Code e o `.zip`
do Chrome. Nada foi publicado nas lojas. O site está em https://gustavomdeschamps.github.io/Gyde/.

## Por fase

**1. A "vibe" das respostas (2.5.0).** Guia de estilo nas instruções, acabamento do texto, conferência do código antes
de entregar (até 2 correções, com aviso de uma linha), polegar e "Comparar respostas" (só no computador), atalhos e
títulos melhores. Medição com 40 pedidos separados, 2 execuções cada (n = 80 por lado): nota 99% contra 97%, +3 pontos
[+1, +4]; o código das respostas rodou em 98% contra 87% (n = 45). Ressalva da revisão: o ganho vem quase todo da
conferência do código, não só do guia, e o critério "o código roda" usa o próprio verificador (decisões 5 e 25).
Começar pela resposta e não usar fórmulas já estavam em 100% antes. Defeito achado ao refazer as capturas: sem o
FreeLLMAPI, o título e o resumo das conversas nunca eram gerados (corrigido).

**2. Forja (2.6.0).** Verificação depois da última mudança, aviso de afirmação sem base, quebra de laço, argumentos
conferidos, GYDE.md, @arquivo, comandos /, desfazer por arquivo e conferência de site. Medição contra a 2.5.0 (3
execuções por cenário): pequenos 12/12 e difíceis 12/12 nas duas (no teto: a medição não mostra ganho neles). Cenário
novo "redesenhar site", A/B da conferência de site no mesmo período, n = 6 de cada lado: 5/6 contra 4/6, +17 pontos
[-17, +50], ou seja, tendência e não prova. A primeira versão da conferência de site não ajudou e foi corrigida antes
dessa rodada (ressalva: corrigida olhando uma falha do próprio cenário).

**3. Qualidade (2.7.0).** `npm audit` de 14 avisos moderados para 0; licenças declaradas e lista dos 65 pacotes do app
conferida por teste; o app deixou de usar remoção recursiva solta; acessibilidade auditada também com conteúdo, nos dois
temas e no celular; ferramenta de desempenho; levantamento dos testes instáveis. Desempenho (n = 5, WebGL por
software): abrir o app 1,24 s; Cidade com 270 prédios no primeiro quadro em 0,84 s, 0,9 ms de CPU por quadro; Ao vivo
0,22 s.

**4. Primeiro uso (2.8.0).** Primeiros passos marcados pelo estado real, Diagnóstico com um pedido real à IA, e a
atualização automática testada de verdade: a 1.9.9 instalada achou a versão nova num servidor local, baixou e instalou
sozinha, com os dados mantidos.

**5. Cidade e Ao vivo (2.9.0).** Ruas de dependência e Saúde do projeto (+105 ms na leitura de uma cidade de 353
arquivos, n = 5). Ao vivo conferido com projetos de verdade: HTML, Vite, Next.js 15 e Python de console, 4 de 4; a
primeira rodada mostrou que o Vite era servido como site estático, e isso foi corrigido com um teste que falha sem a
correção.

**6. Site, documentação e encerramento (2.10.0).** Tutorial animado gravado do app (27 s, 0,3 MB, gerador de GIF próprio),
site e README com perguntas frequentes e limitações, GitHub Pages ligado, revisão crítica independente e limpeza.

## Revisão crítica independente

Um subagente leu o código da v2.4.1 até a Fase 6 e achou 12 problemas. Todos foram corrigidos antes da 2.10.0 (lista em
[decisoes.md](decisoes.md), item 25). Os mais graves:
- um bloco de código da IA podia derrubar o servidor;
- no app instalado, a conferência de JavaScript provavelmente não rodava nada e dizia "rodei e não deu erro";
- o Python rodava com todas as permissões da pessoa atrás de um filtro de texto contornável.

Esses problemas existiam desde a 2.5.0. Por isso a 2.9.0 não ganhou instalador e as correções saíram na 2.10.0. Quem
tem a 2.5.0 a 2.8.0 deve atualizar.

## O que foi desfeito ou não ficou como planejado

- A conferência de site, na primeira versão, não melhorou; foi corrigida e ficou marcada como tendência.
- O Python deixou de ser conferido sozinho (era parte da Fase 1), por segurança.
- O plano da Forja continua opcional: a medição anterior mostrou que ele não melhorava o resultado.
- O script de limpeza apagou as cópias de trabalho do git que estavam em %TEMP%; nada se perdeu (os commits já
  estavam no repositório) e o script passou a pular pastas com `.git`.
- O instalador da 2.8.0 foi refeito a partir da `main` limpa, porque o primeiro terminou de ser gerado enquanto a Fase 5
  já mudava arquivos.

## O que não foi testado numa máquina de verdade

- **Intel UHD 620:** nenhum número desta sessão vem de uma UHD 620; o desempenho foi medido com WebGL por software.
- **Windows 10:** a instalação e a atualização automática foram testadas só no Windows 11 deste computador.
- **Mac e Linux:** os testes automáticos passam no CI, mas o app não foi usado à mão nesses sistemas.
- **Conferência de código no app instalado:** conferida rodando o Gyde.exe empacotado como Node, com a prova de
  execução; o fluxo completo (pergunta pelo app instalado até a linha "Código conferido") não foi feito à mão.
- **Respostas reais com a nova conferência isolada:** a medição de estilo (Fase 1) é anterior ao isolamento; não foi
  repetida depois da revisão.
- **Vite e Next.js no Ao vivo** dependem de internet para o `npm install`.
