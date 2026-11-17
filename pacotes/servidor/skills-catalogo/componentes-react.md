---
id: componentes-react
nome: Componentes React
descricao: Cria componentes React pequenos, com estado no lugar certo e listas com key.
icone: atom
categoria: Aplicativos e APIs
comando: /react
gatilhos: react, componente, jsx, useState, useEffect, props, hooks
---
## Passos
1. Divida a tela em componentes pequenos, cada um com uma responsabilidade.
2. Guarde o estado no componente mais baixo que precisa dele; suba só quando dois irmãos precisarem.
3. Derive valores no render em vez de copiar para outro estado.
4. `useEffect` só para sincronizar com algo de fora (API, timer); limpe no retorno.
5. Listas com `key` estável (id), nunca o índice quando a lista muda.
## Checklist
- Botões de filtro com `aria-pressed` (o leitor de tela diz qual está ativo).
- Mensagem quando a lista filtrada fica vazia (`visiveis.length === 0`).
- Nenhum estado duplicado/derivável.
- `key` com id nas listas.
- `useEffect` com limpeza quando cria timer ou assinatura.
- Props com nomes claros.
## Exemplo
Entrada: "lista de tarefas com filtro"
Saída: `ListaTarefas` com `const visiveis = tarefas.filter(...)` calculado no render, sem `useState` para `visiveis`.
## Erros comuns
- `useEffect` para calcular algo que dá para calcular direto.
- Mudar o array do estado com `push` em vez de criar um novo.
- `key={index}` em lista que reordena.
