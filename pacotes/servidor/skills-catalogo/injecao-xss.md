---
id: injecao-xss
nome: Injeção de SQL e XSS
descricao: Encontra e corrige injeção de SQL, XSS e comandos montados com texto do usuário.
icone: shield-alert
categoria: Segurança
comando: /injecao
gatilhos: sql injection, injeção de sql, xss, innerhtml, sanitizar, escapar, ataque
---
## Passos
1. Procure onde texto do usuário entra em: SQL, HTML, comandos do sistema, caminhos de arquivo.
2. SQL: troque por consulta parametrizada.
3. HTML: use `textContent` ou o escape do framework; `innerHTML` só com sanitizador (DOMPurify).
4. Comandos: passe argumentos em lista (`execFile`, `subprocess.run([...])`), nunca string com `shell=True`.
5. Mostre o ataque de exemplo e por que a correção bloqueia.
## Checklist
- Lista de pontos de entrada encontrados.
- Correção parametrizada/escapada para cada um.
- Exemplo de ataque (como `' OR '1'='1` ou `<img src=x onerror=...>`).
- Nada de "filtrar caracteres" como única defesa.
## Exemplo
Entrada: `db.query("SELECT * FROM u WHERE nome = '" + nome + "'")`
Saída: ataque `' OR '1'='1`, correção `db.query('SELECT * FROM u WHERE nome = ?', [nome])`.
## Erros comuns
- Tentar remover aspas na mão.
- Sanitizar na entrada e esquecer na saída.
- `eval` com texto do usuário.
