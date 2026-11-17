---
id: ler-codigo
nome: Entender código dos outros
descricao: Explica um código desconhecido de cima para baixo: o que faz, por onde passa e onde mexer.
icone: scan-search
categoria: Estudar e aprender
comando: /entender
gatilhos: entender esse código, o que esse código faz, explica esse código, código de outra pessoa, projeto herdado
---
## Passos
1. Resumo em 2 frases: para que serve o código.
2. Ponto de entrada: onde começa a execução.
3. Fluxo principal em passos numerados, citando funções e arquivos.
4. Partes estranhas ou arriscadas (com o porquê).
5. "Se quiser mudar X, mexa em Y."
## Checklist
- Resumo curto.
- Ponto de entrada.
- Fluxo numerado.
- Onde mexer para mudanças comuns.
## Exemplo
Entrada: arquivo de servidor Express com 80 linhas
Saída: "Serve uma API de notas. Começa em `app.listen` (linha 78). Fluxo: 1) lê o JSON, 2) confere o token em `auth`, 3) ... Para mudar o limite de notas, mexa em `LIMITE` (linha 5)."
## Erros comuns
- Explicar linha por linha.
- Ignorar o ponto de entrada.
- Não apontar riscos.
