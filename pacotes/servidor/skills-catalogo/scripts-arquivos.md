---
id: scripts-arquivos
nome: Scripts para arquivos
descricao: Automatiza renomear, mover e organizar arquivos com Python, com simulação antes de mexer.
icone: folder-cog
categoria: Automação e scripts
comando: /arquivos
gatilhos: renomear arquivos, organizar pasta, mover arquivos, script python, automatizar arquivos, pathlib
---
## Passos
1. Use `pathlib` e caminhos recebidos por argumento, nunca fixos.
2. Modo simulação por padrão: o script mostra o que faria e só executa com `--executar`.
3. Nunca sobrescreva: se o destino existe, acrescente um número.
4. Só mexa em arquivos que casam com um filtro explícito (extensão, prefixo).
5. Mostre a saída esperada da simulação.
## Checklist
- Simulação antes de executar.
- Filtro explícito de arquivos.
- Não sobrescreve.
- Nada de apagar arquivos sem pedir.
## Exemplo
Entrada: "organizar fotos por ano"
Saída: script que lê a data de cada `.jpg`, mostra "IMG_001.jpg → 2025/IMG_001.jpg" e só move com `--executar`.
## Erros comuns
- Script que apaga ou sobrescreve sem perguntar.
- Caminho fixo `C:/Users/fulano`.
- Rodar em todos os arquivos da pasta, inclusive o próprio script.
