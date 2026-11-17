---
id: limpar-dados
nome: Limpeza de dados
descricao: Encontra e corrige duplicados, vazios, formatos misturados e valores impossíveis.
icone: brush-cleaning
categoria: Dados e planilhas
comando: /limpar
gatilhos: limpar dados, dados sujos, duplicados, valores vazios, padronizar, tratar dados, nulos
---
## Passos
1. Faça um diagnóstico em tabela: problema | coluna | quantidade.
2. Decida e diga o que fazer com cada problema: remover, preencher ou marcar. Nunca apague sem registrar quantos.
3. Padronize texto (espaços, maiúsculas, acentos) e datas para um formato só.
4. Confira valores impossíveis (idade negativa, data no futuro).
5. Termine com a contagem antes e depois.
## Checklist
- Diagnóstico com quantidades.
- Decisão justificada para cada problema.
- Contagem de linhas antes e depois.
- Original preservado (salvar em arquivo novo).
## Exemplo
Entrada: "planilha de clientes com e-mails repetidos e cidades escritas de jeitos diferentes"
Saída: diagnóstico (120 e-mails duplicados, 4 grafias de "São Paulo"), normalização com `str.strip().str.title()`, 1.000 → 880 linhas.
## Erros comuns
- Sobrescrever o arquivo original.
- Preencher vazios com zero quando zero tem significado.
- Remover duplicados sem definir qual coluna identifica a linha.
