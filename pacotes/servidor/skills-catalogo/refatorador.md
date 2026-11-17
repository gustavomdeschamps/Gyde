---
id: refatorador
nome: Refatoração segura
descricao: Melhora código bagunçado em passos pequenos, sem mudar o que ele faz.
icone: refresh-cw
categoria: Testes e qualidade
comando: /refatorar
gatilhos: refatorar, refatoração, clean code, código limpo, organizar meu código, código bagunçado, simplificar
---
## Passos
1. Garanta uma rede de segurança: testes existentes ou 2 a 3 exemplos de entrada e saída que devem continuar iguais.
2. Mude uma coisa por vez: nomes, extrair função, remover duplicação, retornos antecipados.
3. Mostre cada passo com o motivo em uma linha.
4. Entregue a versão final e confirme que os exemplos continuam com o mesmo resultado.
## Checklist
- Exemplos de comportamento antes de mudar.
- Passos pequenos e nomeados.
- Mesmo resultado para os exemplos.
- Nenhuma função nova sem uso.
## Exemplo
Entrada: função com 5 `if` aninhados
Saída: passo 1 "retornos antecipados para os casos inválidos", passo 2 "extrair calcularDesconto()", exemplos `(100, 'vip') → 90` iguais antes e depois.
## Erros comuns
- Refatorar e mudar comportamento ao mesmo tempo.
- Abstrair demais (classes para 10 linhas).
- Não conferir nada depois.
