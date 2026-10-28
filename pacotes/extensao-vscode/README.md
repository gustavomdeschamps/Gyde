# Gyde: tutor de programação com IA

**Entenda o erro, não só corrija.** O Gyde é um tutor de programação com IA, em português, dentro do VS Code.
Selecione um código e ele explica. Clique numa linha com erro e ele mostra **onde está, por que acontece e como
corrigir**, no nível de quem está aprendendo. Grátis.

![Gyde no VS Code](https://raw.githubusercontent.com/gustavomdeschamps/Gyde/main/docs/imagens/vscode.jpg)

## O que ele faz

| | |
|---|---|
| **Explicar com o Gyde** | Selecione um trecho e aperte `Ctrl+Alt+G` (ou botão direito). O Gyde explica linha por linha. |
| **Explicar o erro desta linha** | Com o cursor numa linha sublinhada de vermelho: ele lê o erro e o código em volta e explica a causa. |
| **Revisar com o Gyde** | Revisa a seleção ou o arquivo inteiro: bugs, nomes, organização e dicas para melhorar. |
| **Chat na barra lateral** | Pergunte qualquer coisa de programação. As respostas vêm formatadas, com blocos de código. |
| **Inserir no editor** | Cada bloco de código da resposta tem **Inserir** (no cursor) e **Copiar**. |
| **Skills** | Use as suas skills do Gyde no chat, como `/revisar`, `/git` e `/sql`. |
| **Continua no navegador** | A conversa fica salva: **abrir no Gyde** mostra a mesma conversa no app completo. |

<p align="center">
  <img src="https://raw.githubusercontent.com/gustavomdeschamps/Gyde/main/docs/imagens/vscode-inicio.jpg" alt="Tela inicial do Gyde no VS Code" width="300">
  <img src="https://raw.githubusercontent.com/gustavomdeschamps/Gyde/main/docs/imagens/vscode-conversa.jpg" alt="Gyde explicando um erro no VS Code" width="300">
</p>

## O app completo, de graça

A extensão conversa com o **Gyde**, um app grátis que roda no seu computador e usa modelos de IA grátis.
Além do chat, o app tem:

- **Forja, o agente de código:** abra a pasta de um projeto, peça uma tarefa e ela trabalha sozinha,
  como um desenvolvedor: lê o código, cria e edita arquivos, roda os testes até passarem e documenta.
- **Passo a passo:** roda o código linha por linha mostrando o valor de cada variável.
- **Prática:** trilhas, projetos guiados com testes automáticos, XP e desafio do dia.

![Forja trabalhando num projeto](https://raw.githubusercontent.com/gustavomdeschamps/Gyde/main/docs/imagens/forja.jpg)

## Como começar

A extensão precisa do app Gyde aberto no seu computador (Windows).

1. **Instale o Gyde** seguindo o passo a passo:
   [github.com/gustavomdeschamps/Gyde](https://github.com/gustavomdeschamps/Gyde/blob/main/COMO-INSTALAR.md) (uns 15 minutos, tudo grátis).
2. **Abra o Gyde** (o app do Gyde ou o `iniciar.bat`).
3. No Gyde, vá em **Configurações → Extensões → Gerar token** e copie.
4. No VS Code, clique no ícone do Gyde na barra da esquerda e em **Colar token**.

Pronto. O token fica guardado no cofre de senhas do VS Code. Para sair: comando **Gyde: Desconectar**.

## Comandos e atalhos

| Comando | Atalho | Onde |
|---|---|---|
| Gyde: Abrir o chat | `Ctrl+Alt+G` (sem seleção) | Paleta de comandos |
| Explicar com o Gyde | `Ctrl+Alt+G` (com seleção) | Botão direito no editor |
| Revisar com o Gyde | | Botão direito no editor |
| Explicar o erro desta linha | | Botão direito no editor |
| Gyde: Nova conversa | | Botão `+` no painel |
| Gyde: Conectar (colar token) | | Paleta de comandos |
| Gyde: Desconectar | | Paleta de comandos |

## Configuração

| Opção | Padrão | Para que serve |
|---|---|---|
| `gyde.servidor` | `http://127.0.0.1:3210` | Endereço do Gyde (o mesmo que abre no navegador). Mude se você trocou a porta. |

## Privacidade

A extensão só conversa com o Gyde do **seu** computador. Ela manda o código que você selecionou ou o arquivo que
pediu para revisar, e nada mais. Sua conta e suas conversas ficam no seu computador.

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "Não consegui falar com o Gyde" | Abra o Gyde (o app ou o `iniciar.bat`) e tente de novo. |
| Token inválido | Gere um token novo no Gyde (Configurações → Extensões) e use **Gyde: Conectar**. |
| O ícone não aparece | Recarregue o VS Code: `Ctrl+Shift+P` → **Reload Window**. |

---

Feito por **Gustavo Moreira Deschamps**. Código aberto (licença MIT):
[github.com/gustavomdeschamps/Gyde](https://github.com/gustavomdeschamps/Gyde).
Achou um problema? [Abra uma issue](https://github.com/gustavomdeschamps/Gyde/issues).
