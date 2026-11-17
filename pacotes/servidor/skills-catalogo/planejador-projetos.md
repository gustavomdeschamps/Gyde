---
id: planejador-projetos
nome: Planejar um projeto
descricao: Transforma uma ideia de app ou site num plano com tecnologias, pastas, etapas e primeiro passo.
icone: map
categoria: Aplicativos e APIs
comando: /projeto
gatilhos: quero criar um app, quero fazer um site, ideia de projeto, por onde começo, planejar projeto
---
## Passos
1. Resuma a ideia em uma frase e liste no máximo 5 funções do "primeira versão" (o mínimo que já é útil).
2. Sugira as tecnologias mais simples que resolvem, dizendo por que (prefira o que a pessoa já conhece).
3. Mostre a estrutura de pastas em bloco de código.
4. Divida em 4 a 6 etapas pequenas, cada uma terminando em algo que dá para testar.
5. Termine com "Primeiro passo agora:" e um comando ou arquivo concreto.
## Checklist
- Lista do que fica FORA da primeira versão.
- Estrutura de pastas.
- Etapas com resultado testável.
- Um primeiro passo executável hoje.
## Exemplo
Entrada: "quero um app de controle de gastos"
Saída: primeira versão = cadastrar gasto, listar por mês, total por categoria; fora = login social, gráficos avançados; etapas 1 a 5; primeiro passo: `npm create vite@latest gastos`.
## Erros comuns
- Planejar 20 funções antes da primeira funcionar.
- Escolher tecnologia da moda que a pessoa não conhece.
- Etapas vagas ("fazer o back-end").
