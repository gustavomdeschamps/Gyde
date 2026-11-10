# Textos para a Chrome Web Store (não vai dentro do .zip)

Cole estes textos no painel de desenvolvedor da Chrome Web Store, na aba **Listagem da loja**.

**Nome:** Gyde — seu guia na programação

**Resumo (até 132 caracteres):**
Converse com o Gyde num painel lateral: ele lê a página, a seleção ou um print e, no modo agente, faz o que você pedir na aba.

**Categoria:** Educação

**Idioma:** Português (Brasil)

**Descrição:**

O Gyde é um tutor de programação com IA, em português e grátis. Esta extensão abre o Gyde num painel lateral do Chrome.

O que ela faz:
- Lê a página aberta, o texto que você selecionar ou um print da tela, e explica.
- Botão direito num código: Explicar com o Gyde ou Revisar este código com o Gyde.
- Modo agente: você dá o comando e o Gyde faz sozinho na aba aberta, mostrando cada passo. Ele para e pergunta antes
  de comprar, pagar, excluir ou enviar algo que você não pediu, e nunca preenche senha, cartão, CPF ou código de
  verificação.
- Escolha entre Gyde 1 e Gyde 1 Pro; embaixo de cada resposta aparece o modelo que respondeu.

Do que precisa:
1. O app do Gyde (grátis, para Windows) instalado e aberto: github.com/gustavomdeschamps/Gyde
2. A IA conectada no app, em Configurações → Conectar IA (chave grátis da NVIDIA ou do Google).
3. Um token criado no app, em Configurações → Extensões, colado no painel.

Privacidade: a extensão só conversa com o app do Gyde no seu próprio computador (127.0.0.1). O app manda a pergunta
para o serviço de IA que você conectou. Sua conta e suas conversas ficam no seu computador.

Código aberto (licença MIT), feito por Gustavo Moreira Deschamps.

**Imagem de tela:** `loja/captura-1280x800.png` (já no tamanho que a loja pede).

**Justificativa das permissões** (a loja pergunta):
- `sidePanel`: mostrar o Gyde no painel lateral.
- `contextMenus`: os itens "Explicar com o Gyde" do botão direito.
- `storage`: guardar o endereço do Gyde, o token e a conversa aberta.
- `activeTab`, `scripting`, `tabs`: ler a página, a seleção ou o print da aba atual quando você pede, e o modo agente.
- Acesso a `127.0.0.1:3210` e `localhost:3210`: falar com o app do Gyde no seu computador.
- Acesso opcional a todos os sites: só quando você usa o modo agente numa página.
