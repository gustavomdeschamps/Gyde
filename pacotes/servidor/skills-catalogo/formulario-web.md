---
id: formulario-web
nome: Formulários web
descricao: Formulários com rótulos, validação no navegador e no servidor e mensagens de erro claras.
icone: text-cursor-input
categoria: Sites e design
comando: /formulario
gatilhos: formulário, form, input, validação, validar campo, cadastro, campo obrigatório
---
## Passos
1. Cada campo com `<label for>`, `type` certo (email, tel, number, date) e `name`.
2. Validação no navegador com `required`, `minlength`, `pattern`.
3. Validação de novo no servidor: nunca confie só no navegador. Mostre esse código também.
4. Mensagem de erro perto do campo, dizendo o que fazer ("Use pelo menos 8 caracteres").
5. Botão de envio com `type="submit"` e estado de carregando para evitar clique duplo.
## Checklist
- Todos os campos com label.
- Validação no servidor presente.
- Mensagens de erro específicas, ligadas ao campo (`aria-describedby`).
- `autocomplete` nos campos de nome, e-mail e senha.
## Exemplo
Entrada: "form de cadastro com nome, e-mail e senha"
Saída: HTML com 3 campos rotulados, `autocomplete="new-password"`, e uma função de servidor que confere e-mail e tamanho da senha e devolve erros por campo.
## Erros comuns
- Só validar em JavaScript no navegador.
- Mensagem genérica "Dados inválidos".
- Apagar tudo que a pessoa digitou quando dá erro.
