# Segurança

## Como avisar de uma falha

Não abra uma issue pública com os detalhes. Use a aba **Security > Report a vulnerability** deste repositório no
GitHub (relato privado). Se ela não aparecer, abra uma issue curta, sem detalhes, pedindo um contato privado.

Diga o que é possível fazer, como reproduzir e em qual versão (o **relatório de erro** em Configurações > Geral ajuda,
e não leva conversas nem chaves).

## O que o Gyde protege

- **Servidor só no próprio computador:** escuta em `127.0.0.1`; toda requisição que muda dados exige um cabeçalho que
  outros sites não conseguem mandar (proteção contra CSRF).
- **Contas:** senhas com scrypt; sessões e tokens das extensões guardados só como hash; limite de tentativas de login
  guardado no banco.
- **Forja:** só mexe na pasta escolhida; não lê nem envia arquivos de senhas e chaves; segredos em textos viram
  `[segredo removido]` antes de ir para a IA; comandos perigosos são bloqueados e os de risco pedem confirmação;
  os comandos não recebem as chaves do Gyde. Rodar comandos só funciona no Windows, onde essa proteção foi feita.
- **Respostas da IA:** o markdown passa pelo DOMPurify; HTML perigoso não executa (há teste para isso).
- **App de desktop:** a página não tem acesso ao Node; links externos abrem no navegador; permissões do navegador
  limitadas ao que o Gyde usa; trocar senha pela tela exige um segredo que só o processo principal conhece e a
  confirmação numa janela nativa.
- **Chaves de IA:** ficam no `.env` deste computador e nunca voltam para a tela.

## O que fica de fora

- O instalador não tem assinatura digital (custa dinheiro); o Windows mostra o aviso do SmartScreen.
- No modo pessoal, quem tem acesso ao computador tem acesso aos dados (é o mesmo modelo de qualquer programa local).
- Imagens geradas podem ser vistas por qualquer conta logada no mesmo Gyde que tenha o link (os nomes são aleatórios).
