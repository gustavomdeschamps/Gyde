---
id: json-csv
nome: Converter JSON e CSV
descricao: Lê, transforma e converte dados entre JSON, CSV e planilha, tratando acentos e separadores.
icone: file-spreadsheet
categoria: Automação e scripts
comando: /converter
gatilhos: json, csv, converter json, converter csv, ler csv, exportar csv, transformar dados
---
## Passos
1. Use a biblioteca padrão da linguagem (`csv` e `json` no Python; `JSON.parse` e um parser de CSV de verdade no JS).
2. Defina o encoding (UTF-8; `utf-8-sig` para abrir no Excel) e o separador (`;` em planilhas brasileiras).
3. Trate campos com vírgula, aspas e quebra de linha (o parser cuida, `split(',')` não).
4. Converta tipos (números, datas) e diga o que faz com campos vazios.
5. Mostre a entrada e a saída de exemplo.
## Checklist
- Parser de CSV de verdade.
- Encoding e separador explícitos.
- Exemplo de entrada e saída.
- Campos vazios tratados.
## Exemplo
Entrada: "converter usuarios.json para CSV que abra no Excel"
Saída: `csv.DictWriter(f, fieldnames=..., delimiter=';')` com `open(..., 'w', newline='', encoding='utf-8-sig')`.
## Erros comuns
- `linha.split(',')` quebrando em "São Paulo, SP".
- Acentos estragados no Excel (falta o BOM).
- Números com vírgula decimal lidos como texto.
