# Testes instáveis no CI (levantamento de 18/11/2026)

Todas as execuções do CI que falharam desde 29/10/2026 (18 execuções), com o teste que falhou e o que se sabe da causa.
"Causa confirmada" quer dizer que a correção foi feita sabendo o porquê; "mitigado" quer dizer que o teste ficou mais
tolerante sem a causa ter sido vista.

| Teste | Sistema | Vezes | Última | Situação |
|---|---|---|---|---|
| Skills: "Ver e instalar" da Loja não abre o diálogo | Windows | 3 | 18/11 | **Mitigado, causa não confirmada.** O teste passou a esperar o cartão (2.4.1) e, na 2.6.0, repete o clique até o diálogo abrir, conferindo o conteúdo depois. Localmente nunca falhou. Hipótese: o clique cai enquanto a lista da Loja é redesenhada. |
| Cidade: cartão do prédio não abre ao clicar | macOS | 3 | 16/11 | **Causa confirmada** (2.4.x): o clique caía antes de o prédio estar sob o ponteiro; o teste confere o destaque antes de clicar. Não voltou. |
| Cidade: o HUD não mostra o que a Forja leu ou criou | macOS | 6 | 16/11 | **Causa confirmada** (2.4.x): o sinal chegava antes de a cena estar montada e se perdia; a tela guarda os sinais recentes e aplica quando a cena abre. Não voltou. |
| Regressão: página da Forja "abre sem erro" | Windows | 1 | 17/11 | **Causa confirmada** (2.4.0): o teste lia a página antes de ela montar; agora espera a montagem. |
| Token das extensões / troca de senha / chat (textContent) | vários | 4 | 13/11 | Em branches de desenvolvimento, durante a mudança do próprio recurso; eram falhas reais corrigidas antes do merge, não instabilidade. |
| Chat: "o que já tinha chegado fica salvo" ao parar | Windows | 1 | 29/10 | Não voltou em 20 dias; sem registro da causa. |

Como conferir de novo: `gh run list --limit 60` e `gh run view <id> --log-failed`, procurando por `FALHOU` e pelos testes do node marcados como falhos.
