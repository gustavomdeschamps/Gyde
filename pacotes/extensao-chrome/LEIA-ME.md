# Gyde para Chrome

Painel lateral do Gyde dentro do navegador. Ele lê a página aberta, o texto que você selecionar
ou um print da tela, e te explica.

## Instalar

1. Deixe o app do Gyde aberto.
2. No Chrome, abra `chrome://extensions`.
3. Ligue o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e escolha esta pasta (`pacotes\extensao-chrome`, dentro da pasta do Gyde).
5. Fixe o ícone do Gyde na barra (ícone de peça de quebra-cabeça → alfinete).

## Conectar

1. No Gyde, abra **Configurações → Extensões → Gerar token** e copie o token.
2. Clique no ícone do Gyde no Chrome (ou **Alt+G**), cole o token e clique em **Conectar**.

## Usar

- **Página**, **Seleção** e **Print**: anexam o conteúdo da aba atual à pergunta.
- Botão direito num texto selecionado: **Explicar com o Gyde** ou **Revisar este código com o Gyde**.
- Botão direito na página: **Perguntar ao Gyde sobre esta página**.
- Os comandos das suas skills (como `/revisar`) também funcionam aqui.

## Modo agente

Clique em **Agente** e dê o comando (ex.: "procure no MDN como usar fetch e abra o exemplo").
O Gyde faz sozinho na aba aberta: uma **seta azul** vai até cada botão ou campo, clica e digita
letra por letra. O painel mostra cada passo e o botão **Parar** encerra na hora.

Ele só para e pergunta quando:
- falta uma informação que só você sabe;
- a ação não tem volta e você não pediu: comprar, pagar, excluir, mudar a conta, ou enviar algo
  que não estava no comando;
- o campo é de senha, cartão, CPF ou código de verificação (esses ele nunca preenche);
- aparece um captcha, ou a aba é uma página interna do navegador (`chrome://`, loja de extensões).

O que está escrito nos sites é tratado como informação, não como ordem: se uma página tentar
mandar o agente fazer outra coisa, ele ignora. Prefere aprovar cada passo? Marque
**pedir permissão a cada passo**.

O agente age dentro do navegador (na aba aberta); ele não controla outros programas do computador.
Para atualizar a extensão depois de uma versão nova: `chrome://extensions` → Gyde → ↻.
