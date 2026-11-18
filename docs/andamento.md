# Andamento da sessão longa (Fases 1 a 6)

Atualizado a cada etapa. Se a sessão parar, "continue" retoma daqui.

## Fase atual: 1, a "vibe" das respostas (branch `fase-1-respostas`, versão 2.5.0)

Feito:
- Guia de estilo (`docs/guia-de-estilo.md`) aplicado em `IDENTIDADE` (`pacotes/servidor/ia/prompts.ts`); a versão
  anterior fica em `IDENTIDADE_ANTERIOR` para a medição.
- Verificação do código antes de salvar (`ia/verificar-codigo.ts`, `ia/conferir-resposta.ts`): JS com `node --permission`,
  Python só código puro; até 2 correções; aviso de uma linha.
- Acabamento do texto (`acabamento` em `ia/filtro.ts`).
- Testes de unidade (`respostas.test.mjs`) e de navegador (correção do código, polegar, Comparar).
- Medição: nota 99% contra 97%, +3 pontos [+1, +4], n = 80 por lado (ver decisoes.md, item 5).
- "Comparar respostas" e polegar, só no computador; atalhos de teclado; botão "Ir para o fim"; títulos melhores.

Falta na Fase 1:
- CHANGELOG, README, capturas, versão 2.5.0, PR, CI, Release.

## Depois
- Fase 2: Forja (inclui o que estava previsto para a 2.4.2: validação dos argumentos, quebra de laço, honestidade das
  afirmações, fluxo de redesenhar site).
- Fases 3 a 6 e o encerramento.
