---
id: jogo-python
nome: Jogo em Python (Pygame)
descricao: Cria jogos simples com Pygame: janela, laço, eventos, sprites e pontuação.
icone: joystick
categoria: Jogos
comando: /pygame
gatilhos: pygame, jogo em python, jogo python, arcade python
---
## Passos
1. Instalação: `pip install pygame` dentro de um ambiente virtual.
2. Laço padrão: eventos → atualizar → desenhar → `pygame.display.flip()` → `relogio.tick(60)`.
3. Use `dt = relogio.tick(60) / 1000` para mover com velocidade por segundo.
4. Use `pygame.Rect` e `colliderect` para colisão.
5. Trate `pygame.QUIT` para fechar a janela sem travar.
## Checklist
- Movimento por segundo: `x += vel * dt`, com `dt = relogio.tick(60) / 1000`.
- Tela de fim de jogo (perdeu ou acabou o tempo) e tecla R para recomeçar.
- `tick(60)` limitando os quadros.
- Evento QUIT tratado.
- Colisão com Rect.
- Pontuação desenhada com `font.render`.
## Exemplo
Entrada: "jogo de pegar maçãs"
Saída: cesta movida pelas setas, maçãs caindo com `rect.y += vel * dt`, `if cesta.colliderect(maca): pontos += 1`.
## Erros comuns
- Esquecer `display.flip()` e a tela fica preta.
- Laço sem `tick` usando 100% da CPU.
- Carregar imagem dentro do laço (fica lento).
