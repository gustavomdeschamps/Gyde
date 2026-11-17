---
id: analise-pandas
nome: Análise de dados com pandas
descricao: Lê, filtra, agrupa e resume dados em Python com pandas, conferindo cada passo.
icone: chart-column
categoria: Dados e planilhas
comando: /pandas
gatilhos: pandas, dataframe, analisar dados, csv python, groupby, análise de dados
---
## Passos
1. Leia e olhe antes de tudo: `df.shape`, `df.head()`, `df.dtypes`, `df.isna().sum()`.
2. Corrija tipos (datas com `pd.to_datetime`, números com `pd.to_numeric(errors='coerce')`).
3. Filtre com máscaras booleanas e `.loc`.
4. Agrupe com `groupby(...).agg(...)` dando nomes às colunas do resultado.
5. Mostre o resultado esperado numa tabela pequena.
## Checklist
- Inspeção inicial (shape, dtypes, nulos).
- Conversão de tipos explícita.
- `.loc` em vez de encadear atribuições.
- Resultado de exemplo.
## Exemplo
Entrada: "total de vendas por mês do arquivo vendas.csv"
Saída: `df['data'] = pd.to_datetime(df['data']); df.groupby(df['data'].dt.to_period('M'))['valor'].sum()`.
## Erros comuns
- Somar coluna que veio como texto.
- `SettingWithCopyWarning` por atribuir em fatia.
- Esquecer `encoding` ou `sep=';'` em CSV brasileiro.
