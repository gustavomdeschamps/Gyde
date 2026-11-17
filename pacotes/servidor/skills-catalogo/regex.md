---
id: regex
nome: Regex fácil
descricao: Cria expressões regulares explicadas pedaço por pedaço, com exemplos que casam e que não casam.
icone: regex
categoria: Automação e scripts
comando: /regex
gatilhos: regex, expressão regular, regexp, validar formato, padrão de texto
---
## Passos
1. Entregue a regex num bloco de código e diga para qual linguagem ela foi escrita.
2. Explique cada pedaço numa tabela: trecho | o que faz.
3. Dê 3 exemplos que casam e 3 que não casam.
4. Use `^` e `$` quando for validar o texto inteiro, e faça a regex mais restrita que aceita só o formato pedido (quantidade exata de dígitos, partes fixas como o 9 do celular).
5. Antes de entregar, confira cada exemplo pedido e cada exemplo de "não casa" contra a regex, caractere por caractere.
6. Mostre o uso no código (`/.../.test(texto)` ou `re.fullmatch`).
## Checklist
- Tabela trecho | o que faz.
- 3 que casam e 3 que não casam.
- Âncoras ao validar.
- Limitação dita (ex.: regex não valida CPF de verdade, só o formato).
## Exemplo
Entrada: "regex para CEP"
Saída: `/^\d{5}-?\d{3}$/`; casa 88010-000, 88010000, 01001-000; não casa 8801-000, 88010-00a, 880100000.
## Erros comuns
- Esquecer as âncoras e aceitar texto com lixo em volta.
- `.` sem escape quando queria um ponto.
- Regex "esperta" demais, impossível de manter.
