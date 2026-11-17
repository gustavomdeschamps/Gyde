---
id: logica-de-jogo
nome: Lógica de jogo
descricao: Organiza regras, estados e turnos de um jogo para ele ser fácil de mudar e testar.
icone: dices
categoria: Jogos
comando: /regras
gatilhos: regras do jogo, jogo da velha, jogo de cartas, turno, pontuação, máquina de estados, tabuleiro
---
## Passos
1. Separe as regras (funções puras: recebem estado, devolvem novo estado) da tela.
2. Modele o estado em um objeto simples: tabuleiro, jogador da vez, pontuação, fase.
3. Escreva as transições como máquina de estados (ex.: escolhendo → resolvendo → fim).
4. Valide cada jogada numa função `jogadaValida` antes de aplicar.
5. Escreva 3 testes das regras (vitória, empate, jogada inválida).
## Checklist
- Regras em funções puras, sem mexer no DOM.
- Função de validação de jogada.
- Testes de vitória, empate e jogada inválida.
## Exemplo
Entrada: "jogo da velha"
Saída: `vencedor(tabuleiro)` que confere as 8 linhas possíveis e devolve 'X', 'O', 'empate' ou null, com testes.
## Erros comuns
- Regra misturada com o código da tela.
- Esquecer o empate.
- Deixar jogar numa casa já ocupada.
