---
id: readme-projeto
nome: README do projeto
descricao: Escreve um README que faz alguém instalar e usar o projeto em 5 minutos.
icone: book-open
categoria: Documentação
comando: /readme
gatilhos: readme, leia-me, documentar projeto, apresentar projeto no github
---
## Passos
1. Seções nesta ordem: nome e uma frase do que faz; imagem ou GIF (se houver); como instalar; como usar; como rodar os testes; licença.
2. Comandos em blocos de código, um por linha, que funcionam copiando e colando.
3. Diga os pré-requisitos com versão (Node 20+, Python 3.11+).
4. Variáveis de ambiente em tabela: nome | para que serve | obrigatória.
5. Nada inventado: onde faltar informação, deixe marcado para a pessoa preencher.
## Checklist
- Frase de abertura clara.
- Pré-requisitos com versão.
- Instalação e uso com comandos.
- Tabela de variáveis de ambiente (se houver).
## Exemplo
Entrada: "README para minha API de tarefas em Node"
Saída: `# API de Tarefas` / "Guarda e lista tarefas por usuário." / Pré-requisitos: Node 20+ / `npm install` / `npm start` / tabela com `PORT` e `DATABASE_URL`.
## Erros comuns
- Começar pela história do projeto.
- Comandos que não funcionam numa máquina limpa.
- Prometer funções que não existem.
