---
id: jogo-canvas
nome: Jogo no navegador (Canvas)
descricao: Monta um jogo 2D em JavaScript com canvas, laço de jogo, teclado e colisão.
icone: gamepad-2
categoria: Jogos
comando: /jogo
gatilhos: jogo, game, canvas, jogo no navegador, jogo em javascript, sprite
---
## Passos
1. Estrutura mínima: um `<canvas>`, um objeto `estado` e as funções `atualizar(dt)` e `desenhar()`.
2. Laço com `requestAnimationFrame`, calculando `dt` em segundos para a velocidade não depender do computador.
3. Teclado com um conjunto de teclas apertadas (`keydown` adiciona, `keyup` remove).
4. Colisão retângulo-retângulo (AABB) numa função separada.
5. Estados do jogo: menu, jogando, fim; tecla para recomeçar.
## Checklist
- Movimento multiplicado por `dt`.
- Função de colisão separada e testável.
- Estado de fim de jogo e recomeço.
- Código em um arquivo HTML que roda ao abrir.
## Exemplo
Entrada: "jogo da nave desviando de asteroides"
Saída: `function colide(a, b) { return a.x < b.x + b.l && a.x + a.l > b.x && a.y < b.y + b.a && a.y + a.a > b.y; }` e o laço com `dt`.
## Erros comuns
- Mover `x += 5` por quadro: em telas de 144 Hz o jogo fica rápido demais.
- Ler teclado só no evento (o movimento trava).
- Desenhar sem limpar o canvas (`clearRect`).
