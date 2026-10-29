# Novidades do Gyde

As extensões têm o próprio histórico: [VS Code](pacotes/extensao-vscode/CHANGELOG.md). A extensão do Chrome segue a
versão do `manifest.json`.

## 2.0.0

Reestruturação completa do código, app de desktop e muitos testes novos. As telas continuam com a mesma cara.

### Novo
- **App de desktop** (Windows): janela própria, abre e fecha o servidor sozinho, seletor de pasta nativo na Forja,
  dados em `%APPDATA%\Gyde` e atualização pelo GitHub. Configurado também para Mac (`.dmg`) e Linux
  (`AppImage`/`.deb`), ainda sem teste nesses sistemas.
- **Trazer os dados do Gyde antigo** para o app de desktop, na tela de entrada.
- **Cópia de segurança:** baixar e restaurar tudo (banco e imagens) em Configurações > Privacidade e dados.
- **Chaves pela tela:** a chave do FreeLLMAPI e a geração de imagens são configuradas em Configurações > IA e
  modelos (antes eram `.bat`).
- **Esqueci minha senha** no app de desktop, com confirmação numa janela do Windows.
- **Relatório de erro** para copiar (Configurações > Geral), sem conversas nem chaves.
- **Modo público** (servidor de uma turma): a tela esconde o que só o dono do servidor configura.

### Melhorias
- Tudo em TypeScript estrito; interface em Svelte 5 com Vite; contratos (Zod) conferem cada resposta entre servidor
  e interface.
- Banco com migrações numeradas e cópia antes de cada atualização.
- Limite de tentativas de login guardado no banco (não zera ao reiniciar).
- O Gyde abre mais rápido: não espera mais a verificação do FreeLLMAPI e do Ollama para mostrar a tela.
- Contraste de cores e celular revisados (auditoria de acessibilidade WCAG 2.1 AA em todas as telas).
- Monorepo em `pacotes/` (servidor, interface, contratos, desktop e as duas extensões).

### Correções
- Forja: comandos com aspas chegavam deformados ao `cmd.exe` (`git commit -m "..."`, `node -e "..."`).
- Chat: depois de Parar, a conversa antiga podia voltar por cima de uma conversa nova.
- Prática de Python mostrava `true`/`false` em vez de `True`/`False`.
- Uso e limites quebrava se o FreeLLMAPI respondesse num formato diferente.
- `redefinir-senha.bat` e o ícone do atalho do instalador apontavam para caminhos antigos.

### Removido
- `configurar-chave`, `configurar-imagens` (substituídos pelas Configurações) e `configurar-voz`: a chave do Gemini
  que ele gravava nunca foi usada; a leitura em voz alta sempre usou a voz do Windows.

### Para quem atualiza
- O banco é atualizado sozinho na primeira abertura, com uma cópia antes em `data/copias-banco`.
- A extensão do Chrome mudou de pasta: recarregue a partir de `pacotes\extensao-chrome`.
- O `iniciar.bat` reinstala as dependências quando elas mudam.
