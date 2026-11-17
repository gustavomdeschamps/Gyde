---
id: design-visual
nome: Design visual
descricao: Escolhe cores, fontes e espaçamentos coerentes para a interface não parecer improvisada.
icone: palette
categoria: Sites e design
comando: /design
gatilhos: design, cores, paleta, fonte, tipografia, espaçamento, visual, bonito, layout feio
---
## Passos
1. Defina 1 cor principal, 1 de destaque e tons de cinza para texto e fundo. Escreva em variáveis CSS (`--cor-principal`).
2. Escolha no máximo 2 fontes: uma para títulos e uma para texto. Tamanho base 16px.
3. Use uma escala de espaçamento fixa (4, 8, 12, 16, 24, 32, 48 px) e só ela.
4. Monte a hierarquia: título maior e mais forte, texto de apoio menor e mais claro.
5. Mostre o resultado em CSS com as variáveis e explique cada escolha em uma frase.
## Checklist
- Cores em variáveis CSS no `:root`.
- Contraste de texto de pelo menos 4,5:1.
- Escala de espaçamento explícita.
- No máximo 2 famílias de fonte.
## Exemplo
Entrada: "meu site está feio, só tem texto preto"
Saída: `:root { --cor-principal: #2f5d8a; --texto: #1d2329; --texto-suave: #5b6670; --fundo: #f7f8fa; --esp-2: 8px; --esp-4: 16px; }` e regras usando essas variáveis.
## Erros comuns
- Usar muitas cores fortes ao mesmo tempo.
- Texto cinza claro em fundo branco (contraste baixo).
- Espaçamentos aleatórios (13px, 17px, 22px).
